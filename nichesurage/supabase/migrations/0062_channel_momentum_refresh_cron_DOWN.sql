-- 0062_channel_momentum_refresh_cron_DOWN.sql
--
-- Reverses 0062: unschedules the refresh-channel-momentum pg_cron job.
--
-- Safe / idempotent: cron.unschedule(name) RAISES if the job name does not
-- exist, so we only call it when the job is present. Does NOT touch the matview
-- itself -- after this it simply stops being refreshed (becomes a static
-- snapshot again).
--
-- FULL ROLLBACK ORDER (after both migrations are applied): run THIS file first
-- (0062 DOWN), THEN 0061 DOWN. Dropping the matview while the cron job still
-- referenced it would make the scheduled REFRESH error every 30 min.
--
-- DEPLOY: apply manually in the Supabase SQL editor.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-channel-momentum') THEN
    PERFORM cron.unschedule('refresh-channel-momentum');
  END IF;
END $$;

-- Post-apply verification (run manually):
--   SELECT count(*) AS still_scheduled
--     FROM cron.job WHERE jobname = 'refresh-channel-momentum';   -- expect 0
