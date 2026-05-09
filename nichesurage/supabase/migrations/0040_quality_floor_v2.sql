-- 0040_quality_floor_v2.sql
--
-- Sprint A.10 follow-up (PR #57). Replaces PR #49's universal subs >= 1000
-- view filter with a content-type-aware version, AND evicts existing
-- watchlist channels below the new floors so scan cron stops burning
-- quota on them.
--
-- New floors (per user 2026-05-09):
--   shorts:   subscriber_count >= 5_000  (was 1_000 universal in PR #49)
--   longform: subscriber_count >= 2_000  (was 1_000 universal in PR #49)
--
-- Rationale: diagnostic showed 58/109 scanned channels had subs < 1K
-- (mostly shorts admitted at the 100-sub promotion floor). They were
-- already hidden from /discover by the universal 1K filter, but cost
-- scan-cycle YouTube quota. Tightening the discover edge function's
-- promotion floor (separate change, same PR) prevents new low-sub
-- promotions; this migration handles the existing watchlist.

-- ─── 1. Replace scan_results_latest view ──────────────────────────────
DROP VIEW IF EXISTS public.scan_results_latest CASCADE;

CREATE VIEW public.scan_results_latest AS
  WITH latest AS (
    SELECT DISTINCT ON (youtube_channel_id) *
      FROM public.scan_results
     ORDER BY youtube_channel_id, scanned_at DESC
  )
  SELECT *
    FROM latest
   WHERE
     (content_type = 'shorts'   AND subscriber_count >= 5000)
     OR
     (content_type = 'longform' AND subscriber_count >= 2000);

-- ─── 2. Evict existing watchlist channels below new floors ────────────
-- Soft-delete (sets evicted_at = now()). Reversible: NULL out the
-- column to restore. Eviction joins to the latest scan to read each
-- channel's current subscriber_count + content_type.

WITH latest_scans AS (
  SELECT DISTINCT ON (youtube_channel_id)
    youtube_channel_id,
    subscriber_count,
    content_type
  FROM public.scan_results
  ORDER BY youtube_channel_id, scanned_at DESC
)
UPDATE public.channels_watchlist cw
SET evicted_at = NOW()
FROM latest_scans ls
WHERE cw.youtube_channel_id = ls.youtube_channel_id
  AND cw.evicted_at IS NULL
  AND (
    (ls.content_type = 'shorts'   AND ls.subscriber_count < 5000)
    OR
    (ls.content_type = 'longform' AND ls.subscriber_count < 2000)
  );

-- Verify after applying:
--   SELECT
--     (SELECT COUNT(*) FROM channels_watchlist WHERE evicted_at IS NULL) AS active,
--     (SELECT COUNT(*) FROM channels_watchlist WHERE evicted_at IS NOT NULL) AS evicted,
--     (SELECT COUNT(*) FROM scan_results_latest) AS visible_on_discover;
--   → expect active to drop ~30-50, evicted to grow by same amount,
--     visible_on_discover to drop ~10-20 short-term (then rebuild over
--     the next 1-2 weeks as scan + discover crons feed in fresh
--     higher-quality candidates).
