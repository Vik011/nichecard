-- 0037_discover_cron_2x.sql
--
-- Increase discover cron cadence from 1×/day (03:00 UTC) to 2×/day
-- (03:00 + 15:00 UTC). Migration 0007 set the original 1×/day schedule
-- and 0026 already raised SCAN to 4×/day, but discover was never touched.
--
-- Rationale (2026-05-08): after the PR #49 quality floor (subscriber_count
-- >= 1000 in scan_results_latest), Premium /discover surfaced only ~50
-- niches against a 200-row target. Doubling discover throughput closes
-- that gap roughly twice as fast as the existing seed rotation can.
--
-- Quota cost: ~1250 YouTube Data API units per discover run × 2 runs/day
-- = 2500 units/day, well within the 18K headroom out of the 20K daily
-- budget (104 channels × 4 scans + 1 discover currently uses ~1750/day).
--
-- IDEMPOTENCY: cron.unschedule first (wrapped in DO block to swallow
-- not-found error), then cron.schedule to (re-)create. Same pattern as
-- 0026.

DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('daily-discover');
    RAISE NOTICE 'unscheduled daily-discover (old 1×/day cadence)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'daily-discover was not previously scheduled (skipping unschedule)';
  END;
END $$;

-- Reschedule discover: 2×/day at 03:00 + 15:00 UTC.
-- 12-hour gap leaves room for scan runs (which fire at xx:30 of multiples
-- of 6h) to ingest newly-promoted candidates before the next discover.
SELECT cron.schedule(
  'daily-discover',
  '0 3,15 * * *',
  $$ SELECT public.invoke_edge_function('discover'); $$
);

-- Verify after applying:
--   SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'daily-discover';
--   → schedule should read '0 3,15 * * *'
