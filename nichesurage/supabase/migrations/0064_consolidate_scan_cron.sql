-- 0064: consolidate the scan cron onto a single hourly, version-controlled job.
--
-- WHY: production runs scan on BOTH hourly-scan (0 * * * *, hand-created in the
-- SQL editor with a raw net.http_post + inlined auth, never in the repo) and
-- daily-scan (30 */6 * * *, migration 0026, Vault helper). Both invoke the same
-- `scan` edge function, so prod double-scans 4 extra full-channel sweeps/day —
-- wasted YouTube quota and repo<->prod drift. The shipped landing copy (PR #122)
-- claims a 1h scan interval, which only hourly-scan actually delivers.
--
-- WHAT: codify hourly-scan as the canonical job using the safe Vault helper
-- (public.invoke_edge_function), then retire daily-scan.
--
-- PATTERN: explicit alter-or-create (NOT relying on cron.schedule being an
-- upsert). cron.alter_job mutates an existing job BY jobid in place, so it
-- preserves hourly-scan's jobid + cron.job_run_details history and cannot create
-- a duplicate. cron.alter_job ships in pg_cron >= 1.4; installed version is 1.6.4
-- (see 0062). If hourly-scan is somehow absent, fall back to cron.schedule.
--
-- DEPLOY: apply manually in the Supabase SQL editor (db push is not used here).
-- Rollback: 0064_consolidate_scan_cron_DOWN.sql.

DO $$
DECLARE
  v_jobid bigint;
BEGIN
  -- 1) Codify hourly-scan with the Vault helper.
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'hourly-scan';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(
      job_id  => v_jobid,
      schedule => '0 * * * *',
      command  => $cmd$ SELECT public.invoke_edge_function('scan'); $cmd$
    );
    RAISE NOTICE 'altered existing hourly-scan in place (jobid=%)', v_jobid;
  ELSE
    PERFORM cron.schedule(
      'hourly-scan', '0 * * * *',
      $cmd$ SELECT public.invoke_edge_function('scan'); $cmd$
    );
    RAISE NOTICE 'created hourly-scan';
  END IF;

  -- 2) Retire daily-scan (redundant 6-hourly duplicate of the same scan fn).
  BEGIN
    PERFORM cron.unschedule('daily-scan');
    RAISE NOTICE 'unscheduled daily-scan';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'daily-scan was not scheduled (skipping)';
  END;
END $$;

-- Post-apply verification (run manually):
--   SELECT jobname, schedule, command FROM cron.job
--    WHERE jobname IN ('hourly-scan','daily-scan') ORDER BY jobname;
--   -> hourly-scan = '0 * * * *', command  SELECT public.invoke_edge_function('scan');
--   -> daily-scan  = 0 rows (unscheduled).
