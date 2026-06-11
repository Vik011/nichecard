-- 0064 DOWN: restore the repo's intended pre-0064 state — daily-scan @ 6-hourly
-- via the Vault helper, hourly-scan removed. Same explicit alter-or-create
-- pattern as the UP.
--
-- NOTE: this intentionally does NOT recreate the original hand-made RAW
-- hourly-scan (it was never version-controlled and inlined an auth token).
-- Rolling back returns scan to a single 6-hourly job — clean. Caveat: 6-hourly
-- makes the shipped landing "1h scan interval" copy (PR #122) inaccurate, so
-- prefer fixing forward over rolling back; if you must roll back, revisit the
-- landing cadence copy too.
--
-- DEPLOY: apply manually in the Supabase SQL editor.

DO $$
DECLARE
  v_jobid bigint;
BEGIN
  -- 1) Recreate daily-scan @ 6-hourly via the helper (alter in place if present).
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'daily-scan';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(
      job_id  => v_jobid,
      schedule => '30 */6 * * *',
      command  => $cmd$ SELECT public.invoke_edge_function('scan'); $cmd$
    );
    RAISE NOTICE 'altered existing daily-scan in place (jobid=%)', v_jobid;
  ELSE
    PERFORM cron.schedule(
      'daily-scan', '30 */6 * * *',
      $cmd$ SELECT public.invoke_edge_function('scan'); $cmd$
    );
    RAISE NOTICE 'created daily-scan';
  END IF;

  -- 2) Remove hourly-scan.
  BEGIN
    PERFORM cron.unschedule('hourly-scan');
    RAISE NOTICE 'unscheduled hourly-scan';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'hourly-scan was not scheduled (skipping)';
  END;
END $$;
