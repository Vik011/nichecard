-- 0055_snapshot_retention_tighten.sql
--
-- Sprint S1 (stop the bleeding): video_snapshots retention 60d → 7d.
--
-- Why: at 60d retention the table projects to ~900 MB once full horizon
-- is reached, but Supabase Free tier hard-caps at 500 MB. We are at
-- 117% quota (584 MB) today; video_snapshots alone is 345 MB / 1.06M rows.
--
-- App usage of this table (grep audit 2026-05-26):
--   • clusters/detect: 48-hour `published_at` window
--   • thumbnails/phash + fetchLatestTitles: direct video_id lookups (no time filter)
-- 7 days is a 3.5× safety margin over the longest active query window.
--
-- Idempotent. Re-running re-asserts the schedule and the 7-day DELETE
-- (which will be a no-op once the next cron tick has purged old rows).
--
-- After applying this migration, run VACUUM FULL + REINDEX manually
-- to reclaim disk to the OS (see commit message for the exact commands).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'drop_old_snapshots',
      '0 3 * * *',
      $job$DELETE FROM video_snapshots WHERE scanned_at < now() - interval '7 days'$job$
    );
    RAISE NOTICE 'pg_cron job drop_old_snapshots updated (daily 03:00 UTC, 7d retention)';
  ELSE
    RAISE NOTICE 'pg_cron not enabled — retention job NOT updated. Enable pg_cron then re-run.';
  END IF;
END $$;

-- Immediate purge so we do not wait until 03:00 UTC for the first 7d cutoff.
DELETE FROM video_snapshots WHERE scanned_at < now() - interval '7 days';
