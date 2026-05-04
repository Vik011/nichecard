-- 0025_snapshot_retention.sql
--
-- Sprint B Phase 2: drop video_snapshots rows older than 60 days, daily.
-- pg_cron must be enabled in Supabase project (Database → Extensions).
-- If not yet enabled, this migration prints a NOTICE and skips silently —
-- enable pg_cron in the Dashboard, then re-run this file.
--
-- Run manually in Supabase SQL editor (same workflow as every other
-- migration in this directory). Idempotent: safe to re-run.
--
-- Verify after applying:
--   SELECT count(*) FROM cron.job WHERE jobname = 'drop_old_snapshots';
-- → 1 if scheduled, 0 if pg_cron not enabled yet.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- cron.schedule is upsert-by-jobname under the hood, so re-runs no-op.
    PERFORM cron.schedule(
      'drop_old_snapshots',
      '0 3 * * *',
      $job$DELETE FROM video_snapshots WHERE scanned_at < now() - interval '60 days'$job$
    );
    RAISE NOTICE 'pg_cron job drop_old_snapshots scheduled (daily 03:00 UTC)';
  ELSE
    RAISE NOTICE 'pg_cron not enabled — retention job NOT scheduled. Enable pg_cron in Supabase Dashboard (Database → Extensions) then re-run this migration.';
  END IF;
END $$;
