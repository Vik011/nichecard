-- 0062_channel_momentum_refresh_cron.sql
--
-- WHY:
-- 0061 turned channel_current_momentum into a MATERIALIZED VIEW -- a point-in-
-- time snapshot whose current_eligible / *_age_hours are baked at refresh time
-- (they depend on now()). Without a periodic refresh it drifts: videos aging
-- past the 26h / content-type windows stay "eligible", and newly spiking videos
-- never appear. This schedules a pg_cron job to REFRESH it every 30 minutes,
-- bounding staleness to <=30 min (accepted vs the 26h eligibility threshold).
--
-- WHY CONCURRENTLY:
-- REFRESH ... CONCURRENTLY swaps in the new contents WITHOUT an ACCESS EXCLUSIVE
-- lock, so Spiking Now reads never block and never see an empty matview during a
-- refresh. It REQUIRES a unique index (created in 0061:
-- channel_current_momentum_channel_uidx) and an already-populated matview (true
-- after 0061). It must also run as a TOP-LEVEL statement -- NOT inside a function
-- or an explicit BEGIN/END. pg_cron runs each job command at top level (the same
-- way it runs VACUUM), so the bare REFRESH below is correct. Do not wrap it.
--
-- IDEMPOTENT: cron.schedule(name, ...) upserts by job name (pg_cron >= 1.4;
-- installed version is 1.6.4), so re-running this UP updates the single job
-- instead of creating a duplicate.
--
-- OWNERSHIP / DATABASE: the job runs as its creator (postgres, via the SQL
-- editor), which owns the matview, so it is allowed to REFRESH it. It runs in
-- the current database, where both pg_cron and the matview live -- no
-- cron.schedule_in_database needed.
--
-- DEPLOY: apply manually in the Supabase SQL editor AFTER 0061 is applied and
-- verified. Rollback: 0062_channel_momentum_refresh_cron_DOWN.sql.

SELECT cron.schedule(
  'refresh-channel-momentum',
  '*/30 * * * *',                                                            -- every 30 min (:00 and :30)
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.channel_current_momentum; $$
);

-- Post-apply verification (run manually):
--   1. Job registered:
--      SELECT jobid, jobname, schedule, active, command FROM cron.job
--       WHERE jobname = 'refresh-channel-momentum';
--   2. (Optional, immediate) prove a CONCURRENTLY refresh works on this matview
--      now, without waiting for the first cron tick (run as postgres):
--      REFRESH MATERIALIZED VIEW CONCURRENTLY public.channel_current_momentum;
--   3. After the next :00/:30 boundary, confirm a successful scheduled run:
--      SELECT status, return_message, start_time, end_time
--        FROM cron.job_run_details
--       WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname='refresh-channel-momentum')
--       ORDER BY start_time DESC LIMIT 3;       -- expect status = 'succeeded'
