-- 0061_channel_current_momentum_matview.sql
--
-- WHY:
-- channel_current_momentum (0058/0059) is a request-time VIEW. The Spiking Now
-- request (current_eligible=true AND trend_score>=70, no LIMIT) forces Postgres
-- to GROUP BY the entire video_snapshots table (~405k rows, ~7s cold), join
-- video_metrics / channels_watchlist / scan_results_latest, compute
-- current_eligible per row, and DISTINCT ON across all channels -- on EVERY
-- request. Measured EXPLAIN ANALYZE (2026-06-06, authenticated role):
-- 13,276 ms for 24 output rows. authenticated statement_timeout = 8s, so the
-- query is cancelled (57014) and PostgREST returns 500 -> "Spiking Now" renders
-- empty. Tier-independent (the momentum query shape does not change by tier).
--
-- FIX:
-- Precompute the SAME query into a MATERIALIZED VIEW of the SAME name and an
-- IDENTICAL column list. The request-time read becomes a scan of ~one row per
-- channel (<5 ms). A pg_cron job (migration 0062) REFRESHes it every 30 min.
-- Eligibility (current_eligible, *_age_hours) is therefore baked at refresh
-- time => at most ~30 min stale vs a 26h eligibility threshold. Accepted: a
-- live production 500 on Spiking Now is worse than minor eligibility lag.
--
-- SECURITY (signed off):
-- A materialized view cannot carry RLS, so access is GRANT-only: SELECT to
-- anon / authenticated / service_role, no writes. The data is public per-channel
-- YouTube momentum already exposed via the discover feed. Because content_type
-- is now baked at REFRESH time under the matview owner's visibility, the 0059
-- anon content_type=NULL divergence (channels_watchlist is authenticated-only)
-- can no longer occur -- every reader sees the same precomputed value.
--
-- FRONTEND: unchanged. Same relation name + columns + PostgREST surface; the
-- generated DB types do not include this relation (callers cast through unknown).
--
-- APPLY-TIME SAFETY:
-- Build under a temp name and populate + unique-index it OFF-lock, then DROP the
-- old view + RENAME in one short transaction (millisecond lock window). The live
-- view keeps serving (slowly) during the ~13s populate; no error/stall window.
-- Retry-safe: a failed run that already created the temp matview can be re-run
-- (step 0 drops it first; the live channel_current_momentum view is never
-- touched until the atomic swap).
--
-- DEPLOY: apply manually in the Supabase SQL editor (no db push / CI in this
-- project). Rollback: 0061_channel_current_momentum_matview_DOWN.sql.

-- 0) Retry-safe cleanup: a previous failed run may have left the temp matview.
--    This never touches the live public.channel_current_momentum view.
DROP MATERIALIZED VIEW IF EXISTS public.channel_current_momentum_new;

-- 1) Build the precomputed relation under a TEMP name (no lock on the live
--    view; ~13s one-time populate). Defining query is byte-for-byte the 0059
--    view body -- same CTEs, same final column list, same ORDER BY.
CREATE MATERIALIZED VIEW public.channel_current_momentum_new AS
WITH snap_agg AS (
  SELECT
    video_id,
    channel_id,
    max(scanned_at)   AS last_snapshot_at,
    count(*)          AS snapshot_count,
    min(published_at) AS published_at
  FROM public.video_snapshots
  GROUP BY video_id, channel_id
),
channel_video AS (
  SELECT
    vm.channel_id                                               AS youtube_channel_id,
    COALESCE(cw.content_type, sr.content_type)                  AS content_type,
    vm.video_id                                                 AS best_video_id,
    sa.last_snapshot_at,
    sa.snapshot_count::int,
    vm.trend_score,
    vm.lifecycle_status,
    vm.velocity_delta,
    vm.views_per_hour,
    extract(epoch from (now() - sa.last_snapshot_at)) / 3600.0 AS last_metric_age_hours,
    extract(epoch from (now() - sa.published_at))     / 3600.0 AS best_video_age_hours
  FROM public.video_metrics vm
  INNER JOIN snap_agg sa
          ON sa.video_id   = vm.video_id
         AND sa.channel_id = vm.channel_id
  LEFT JOIN public.channels_watchlist cw
         ON cw.youtube_channel_id = vm.channel_id
  LEFT JOIN public.scan_results_latest sr
         ON sr.youtube_channel_id = vm.channel_id
),
ranked AS (
  SELECT
    *,
    COALESCE(
      last_metric_age_hours <= 26
      AND views_per_hour   >  0
      AND snapshot_count   >= 2
      AND lifecycle_status IN ('emerging', 'exploding', 'peak')
      AND content_type     IN ('shorts', 'longform')
      AND best_video_age_hours <= CASE
            WHEN content_type = 'shorts' THEN 72
            ELSE 336
          END
    , false) AS current_eligible
  FROM channel_video
)
SELECT DISTINCT ON (youtube_channel_id)
  youtube_channel_id,
  content_type,
  best_video_id,
  best_video_age_hours,
  last_metric_age_hours,
  snapshot_count,
  trend_score,
  lifecycle_status,
  velocity_delta,
  views_per_hour,
  current_eligible,
  last_snapshot_at
FROM ranked
ORDER BY
  youtube_channel_id,
  (CASE WHEN current_eligible THEN 0 ELSE 1 END) ASC,  -- eligible video selected first
  trend_score      DESC NULLS LAST,                     -- highest trend within group
  views_per_hour   DESC,
  last_snapshot_at DESC;                                -- tiebreak: most recent snapshot

-- 2) Unique index (REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY in 0062)
--    + the same SELECT grants the 0058/0059 view carried. If duplicate
--    youtube_channel_id rows somehow existed, this CREATE fails HERE -- before
--    the swap -- leaving the live view untouched (fail-safe).
CREATE UNIQUE INDEX channel_current_momentum_new_channel_uidx
  ON public.channel_current_momentum_new (youtube_channel_id);

GRANT SELECT ON public.channel_current_momentum_new
  TO anon, authenticated, service_role;

-- 3) Atomic swap: drop the old VIEW and promote the matview to the canonical
--    name. Short transaction => millisecond ACCESS EXCLUSIVE window for readers.
BEGIN;
  DROP VIEW IF EXISTS public.channel_current_momentum;
  ALTER MATERIALIZED VIEW public.channel_current_momentum_new
    RENAME TO channel_current_momentum;
  ALTER INDEX public.channel_current_momentum_new_channel_uidx
    RENAME TO channel_current_momentum_channel_uidx;
COMMIT;

-- 4) Tell PostgREST to re-introspect (relation kind changed: view -> matview).
--    Supabase's DDL event trigger usually auto-reloads; this is belt-and-braces.
NOTIFY pgrst, 'reload schema';

-- Post-apply verification (run manually after applying):
--   1. Relation is now a matview with grants:
--      SELECT relkind FROM pg_class WHERE relname='channel_current_momentum';  -- 'm'
--   2. Re-run the Spiking Now EXPLAIN ANALYZE as authenticated -> expect < 50 ms.
--   3. anon smoke (0059 check B):
--      BEGIN; SET LOCAL ROLE anon;
--      SELECT count(*) FROM public.channel_current_momentum
--       WHERE current_eligible = true AND trend_score >= 70;  -- expect > 0
--      ROLLBACK;
--   NOTE: until 0062 (pg_cron refresh) is applied, this matview is a STATIC
--   snapshot frozen at apply time. Apply 0062 promptly after verifying 0061.
