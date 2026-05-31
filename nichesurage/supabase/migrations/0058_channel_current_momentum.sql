-- 0058_channel_current_momentum.sql
--
-- WHY:
-- The discover feed reads scan_results_latest, which is append-only. When an
-- outlier video falls out of its scan window, no new row is written (ratio <
-- OUTLIER_DB_FLOOR=2 → continue), so the old spike row survives in
-- scan_results_latest indefinitely. Part A (0057-area, freshness gate on
-- scanned_at) catches frozen rows. Part B (this VIEW) adds a per-channel
-- current-momentum signal so isSpikingNowFromMomentum can verify that the
-- channel still has a genuinely spiking video RIGHT NOW.
--
-- Design constraints (all verified file:line before writing):
--   - lifecycle_status enum = {emerging, exploding, peak, saturated, dying}
--     (0024:29-31). 'saturated' is intentionally excluded from current_eligible
--     to prevent a saturated video masking a lower-trend 'exploding' video from
--     the same channel in the DISTINCT ON selection.
--   - snapshot_count >= 2 enforced inside current_eligible for the same reason:
--     a single-snapshot video would be selected first (eligible=true), then
--     rejected by isSpikingNowFromMomentum, masking the next-best video.
--   - content_type NOT coalesced: NULL content_type → current_eligible = false.
--     Coalescing to 'longform' would give unknown channels the wider 336h window
--     and could incorrectly elevate them in DISTINCT ON ordering.
--   - freshness anchor = max(video_snapshots.scanned_at), NOT video_metrics.
--     computed_at: computed_at is updated on upsert but freezes after the 30d
--     scan cutoff (scan/index.ts:121-123); scanned_at is append-only (0055).
--   - snap_agg INNER JOIN uses BOTH video_id AND channel_id to prevent
--     accidental cross-channel collisions if video_id is ever reused.
--   - security_invoker = on: view runs with caller's privileges so anon RLS on
--     base tables is enforced, not bypassed (0048 pattern). All three base
--     tables have anon SELECT coverage: video_metrics (0024), video_snapshots
--     (0057), channels_watchlist (existing {public} SELECT policy).
--
-- DEPLOY: apply manually in Supabase SQL editor (no db push / CI in this
-- project). Idempotent via DROP IF EXISTS. Rollback in
-- 0058_channel_current_momentum_DOWN.sql.

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
  -- One row per video: trend metrics joined with snapshot freshness and watchlist
  -- content_type. content_type is NOT coalesced so NULL stays NULL.
  SELECT
    vm.channel_id                                               AS youtube_channel_id,
    cw.content_type,
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
--   1. Anon role test (SQL Editor runs as postgres by default — use SET LOCAL ROLE):
--      BEGIN;
--      SET LOCAL ROLE anon;
--      SELECT count(*) FROM public.channel_current_momentum;
--      ROLLBACK;
--
--   2. security_invoker = on:
--      SELECT relname, reloptions FROM pg_class
--       WHERE relname = 'channel_current_momentum';
--      -- reloptions must contain 'security_invoker=on'
--
--   3. NightRegistry probe (replace UCID):
--      SELECT youtube_channel_id, content_type, current_eligible,
--             last_metric_age_hours, best_video_age_hours, snapshot_count,
--             lifecycle_status, trend_score
--        FROM public.channel_current_momentum
--       WHERE youtube_channel_id = '<NightRegistry_UCID>';
--      -- expect: no row OR current_eligible = false
--
--   4. Distribution check:
--      SELECT count(*) filter (where current_eligible)               AS eligible,
--             count(*) filter (where NOT current_eligible)           AS not_eligible,
--             count(*) filter (where content_type IS NULL)           AS null_content_type,
--             count(*) filter (where snapshot_count = 1)             AS single_snap,
--             count(*) filter (where lifecycle_status = 'saturated') AS saturated
--        FROM public.channel_current_momentum;
