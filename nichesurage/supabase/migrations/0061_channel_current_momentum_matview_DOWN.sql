-- 0061_channel_current_momentum_matview_DOWN.sql
--
-- Reverses 0061: drops the materialized view and restores the 0059 request-time
-- VIEW (security_invoker = on) byte-for-byte, so behaviour returns to pre-0061.
-- (This re-introduces the request-time recompute / potential 8s timeout -- only
-- roll back if the matview itself is the problem.)
--
-- IMPORTANT: this DOWN reverses a FULLY-APPLIED 0061. If 0061 failed BEFORE the
-- atomic swap, the live relation is still the 0059 view (untouched) -- in that
-- case just fix the cause and re-run 0061 UP (it is retry-safe); you do not need
-- this DOWN. The DO block below tolerates either relkind at the canonical name.
--
-- No data loss: the matview is fully derived from base tables.
-- DEPLOY: apply manually in the Supabase SQL editor.

-- Cleanup any leftover temp matview from a failed UP.
DROP MATERIALIZED VIEW IF EXISTS public.channel_current_momentum_new;

-- Drop the canonical relation whether it is currently a matview (applied UP) or
-- a view (UP not swapped). IF EXISTS does NOT tolerate a relkind mismatch, so we
-- branch on pg_class.relkind ('m' = matview, 'v' = view).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'channel_current_momentum' AND c.relkind = 'm'
  ) THEN
    EXECUTE 'DROP MATERIALIZED VIEW public.channel_current_momentum';
  ELSIF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'channel_current_momentum' AND c.relkind = 'v'
  ) THEN
    EXECUTE 'DROP VIEW public.channel_current_momentum';
  END IF;
END $$;

-- Recreate the 0059 view verbatim (security_invoker = on).
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
  (CASE WHEN current_eligible THEN 0 ELSE 1 END) ASC,
  trend_score      DESC NULLS LAST,
  views_per_hour   DESC,
  last_snapshot_at DESC;

GRANT SELECT ON public.channel_current_momentum
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
