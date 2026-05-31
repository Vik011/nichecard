-- 0059_channel_current_momentum_content_type_fallback.sql
--
-- WHY (production bug found via anon-role smoke of PR #107):
-- channel_current_momentum (0058) sources content_type from
-- LEFT JOIN channels_watchlist. The view is security_invoker=on, so under the
-- browser's `anon` role RLS on the base tables is enforced — and
-- channels_watchlist has ONLY an `authenticated` SELECT policy (0003), no anon
-- policy. So for an anon caller the LEFT JOIN matches no row and cw.content_type
-- comes back NULL. The 0058 comment claiming a "{public} SELECT policy" on
-- channels_watchlist was incorrect.
--
-- Because current_eligible requires content_type IN ('shorts','longform'), a
-- NULL content_type forces current_eligible = false for EVERY channel under
-- anon. The view still returns rows (trend_score etc. survive), but none are
-- eligible — so the Discover "Spiking Now" tab is empty in the browser and no
-- badges render, even though the same rows are eligible under postgres.
--
-- Confirmed on UC16swgTZPxywreS9hkuP_Yw:
--   postgres : content_type=longform, current_eligible=true,  trend_score=95.41
--   anon     : content_type=NULL,     current_eligible=false, trend_score=95.41
--   anon scan_results_latest.content_type = longform  (readable!)
--
-- FIX (no broad anon policy on channels_watchlist):
-- scan_results_latest is already anon-readable (security_invoker + scan_results
-- has an anon SELECT policy, 0048) and the Discover feed already reads it. Use
-- it as a fallback content_type source: COALESCE(cw.content_type, sr.content_type).
-- The rest of the eligibility logic is byte-for-byte identical to 0058.
--
-- Safe join cardinality: scan_results_latest is DISTINCT ON (youtube_channel_id)
-- (0048:54-58) → exactly one row per channel → the added LEFT JOIN cannot
-- multiply channel_video rows. Channels below the scan_results_latest quality
-- floor (shorts >=5000 / longform >=2000 subs) are absent from it; if such a
-- channel is also anon-invisible in channels_watchlist, content_type stays NULL
-- and the channel stays NOT eligible — the intended strict behaviour.
--
-- PR #107 already deployed 0058; this migration does NOT rewrite 0058. It is a
-- forward DROP+CREATE. security_invoker and GRANTs are preserved.
--
-- DEPLOY: apply manually in the Supabase SQL editor (no db push / CI in this
-- project). Idempotent via DROP IF EXISTS. Rollback in
-- 0059_channel_current_momentum_content_type_fallback_DOWN.sql.

DROP VIEW IF EXISTS public.channel_current_momentum;

CREATE VIEW public.channel_current_momentum
  WITH (security_invoker = on) AS
WITH snap_agg AS (
  -- Per-video freshness: latest snapshot timestamp, count, and stable published_at.
  -- INNER JOIN downstream means channels absent from video_snapshots (all snapshots
  -- pruned after 7d, migration 0055) will not appear → feed LEFT JOIN → NULL →
  -- isSpikingNowFromMomentum returns false (correct behaviour).
  SELECT
    video_id,
    channel_id,
    max(scanned_at)   AS last_snapshot_at,
    count(*)          AS snapshot_count,
    min(published_at) AS published_at     -- published_at is stable; min = any value
  FROM public.video_snapshots
  GROUP BY video_id, channel_id
),
channel_video AS (
  -- One row per video: trend metrics joined with snapshot freshness and content_type.
  -- content_type now falls back to scan_results_latest so it survives the anon
  -- role (channels_watchlist is authenticated-only; sr is anon-readable). NOT
  -- coalesced to a literal so NULL stays NULL when BOTH sources are NULL.
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
    -- freshness from snapshot, not computed_at (which freezes after 30d cutoff)
    extract(epoch from (now() - sa.last_snapshot_at)) / 3600.0 AS last_metric_age_hours,
    -- video age from its original publish date
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
  -- current_eligible mirrors isSpikingNowFromMomentum conditions minus trend_floor
  -- (trend_floor is a runtime constant calibrated in B.4, not a VIEW concern).
  -- Computed in a separate CTE so aliases from channel_video are in scope.
  -- COALESCE(..., false): NULL inputs (NULL content_type, views_per_hour,
  -- trend_score, or best_video_age_hours when published_at is all-NULL) make the
  -- AND-chain evaluate to NULL, not false. We require a STRICT boolean so the
  -- exposed column is never NULL — downstream filters like WHERE NOT
  -- current_eligible behave correctly and NULL content_type is not eligible.
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

GRANT SELECT ON public.channel_current_momentum
  TO anon, authenticated, service_role;

-- Post-apply verification:
--   A. Confirmed channel must now be ELIGIBLE under anon:
--      BEGIN;
--      SET LOCAL ROLE anon;
--      SELECT youtube_channel_id, content_type, current_eligible, trend_score,
--             views_per_hour, lifecycle_status
--        FROM public.channel_current_momentum
--       WHERE youtube_channel_id = 'UC16swgTZPxywreS9hkuP_Yw';
--      ROLLBACK;
--      -- expect: content_type = longform, current_eligible = true
--
--   B. Candidate count under anon must be > 0:
--      BEGIN;
--      SET LOCAL ROLE anon;
--      SELECT count(*) AS spiking_candidates
--        FROM public.channel_current_momentum
--       WHERE current_eligible = true AND trend_score >= 70;
--      ROLLBACK;
--      -- expect: spiking_candidates > 0
--
--   C. security_invoker still on:
--      SELECT relname, reloptions FROM pg_class
--       WHERE relname = 'channel_current_momentum';
--      -- reloptions must contain 'security_invoker=on'
