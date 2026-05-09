-- 0043_trending_cron.sql
--
-- Sprint A.10 follow-up — register the new `trending` edge function on
-- pg_cron at 1×/day, 09:00 UTC. Offset 6h from the discover schedule
-- (03:00 + 15:00 UTC, see 0037) so quota usage is spread.
--
-- Cost estimate: ~60-80 YouTube API units per run × 1 run/day = 60-80
-- units/day. Negligible against the 20K/day budget.
--
-- IDEMPOTENCY: cron.unschedule first (wrapped in DO block), then
-- cron.schedule. Same pattern as 0037.

DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('daily-trending');
    RAISE NOTICE 'unscheduled daily-trending (pre-existing)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'daily-trending was not previously scheduled (skipping unschedule)';
  END;
END $$;

SELECT cron.schedule(
  'daily-trending',
  '0 9 * * *',
  $$ SELECT public.invoke_edge_function('trending'); $$
);

-- Verify after applying:
--   SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'daily-trending';
--   → schedule should read '0 9 * * *'
