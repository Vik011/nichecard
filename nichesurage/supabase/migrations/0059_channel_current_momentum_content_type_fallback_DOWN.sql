-- 0059_channel_current_momentum_content_type_fallback_DOWN.sql
--
-- Rollback for 0059. Restores the 0058 definition of
-- public.channel_current_momentum (content_type sourced ONLY from
-- channels_watchlist, no scan_results_latest fallback).
--
-- NOTE: reverting to 0058 reintroduces the anon-role bug (content_type NULL →
-- current_eligible false under anon → empty Spiking Now in the browser). Only
-- roll back if 0059 itself misbehaves; otherwise prefer the runtime app flag
-- NEXT_PUBLIC_SPIKE_MOMENTUM_MODE=off (+ redeploy) to disable momentum mode
-- without touching the view.
--
-- DEPLOY: apply manually in the Supabase SQL editor. Idempotent via DROP IF EXISTS.

DROP VIEW IF EXISTS public.channel_current_momentum;

CREATE VIEW public.channel_current_momentum
  WITH (security_invoker = on) AS
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
    cw.content_type,
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
  (CASE WHEN current_eligible THEN 0 ELSE 1 END) ASC,
  trend_score      DESC NULLS LAST,
  views_per_hour   DESC,
  last_snapshot_at DESC;

GRANT SELECT ON public.channel_current_momentum
  TO anon, authenticated, service_role;
