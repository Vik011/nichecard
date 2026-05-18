-- 0046_apify_discovery_cron.sql
--
-- Register two pg_cron jobs for the Apify discovery pipeline:
--
--   apify-discover-plan   (0 6,18 * * *)  -- 06:00 + 18:00 UTC, 2x/day
--     Triggers the `discover-plan` edge function, which queues new Apify
--     actor runs for channel discovery. Scheduled at 06:00 and 18:00 UTC
--     to avoid collisions with the legacy discover crons (03:00 + 15:00,
--     see 0037) and the trending cron (09:00, see 0043).
--
--   apify-discover-ingest (0 */2 * * *)   -- every 2 hours
--     Triggers the `discover-ingest` edge function, which polls completed
--     Apify runs and writes any discovered channels into channels_watchlist.
--     A 2-hour polling cadence ensures finished Apify runs land in
--     channels_watchlist within roughly 2 hours of completion.
--
-- IDEMPOTENCY: cron.unschedule first (wrapped in DO block to swallow
-- not-found error), then cron.schedule to (re-)create. Same pattern as
-- 0037 and 0043.

-- --- Job 1: apify-discover-plan -------------------------------------------

DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('apify-discover-plan');
    RAISE NOTICE 'unscheduled apify-discover-plan (pre-existing)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'apify-discover-plan was not previously scheduled (skipping unschedule)';
  END;
END $$;

SELECT cron.schedule(
  'apify-discover-plan',
  '0 6,18 * * *',
  $$ SELECT public.invoke_edge_function('discover-plan'); $$
);

-- --- Job 2: apify-discover-ingest ------------------------------------------

DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('apify-discover-ingest');
    RAISE NOTICE 'unscheduled apify-discover-ingest (pre-existing)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'apify-discover-ingest was not previously scheduled (skipping unschedule)';
  END;
END $$;

SELECT cron.schedule(
  'apify-discover-ingest',
  '0 */2 * * *',
  $$ SELECT public.invoke_edge_function('discover-ingest'); $$
);

-- Verify after applying:
--   SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'apify-discover-%';
--   apify-discover-plan   -> '0 6,18 * * *'
--   apify-discover-ingest -> '0 */2 * * *'
