-- 0026: Increase scan cron cadence from 1×/day to 4×/day for Sprint B trend engine.
--
-- BACKGROUND:
-- Migration 0007 scheduled `daily-scan` at 03:30 UTC (1×/day). With Sprint B's
-- time-series video_snapshots architecture, that gives only ONE data point per
-- video per 24h. Velocity computation needs ≥2 snapshots within a meaningful
-- window; acceleration needs ≥3. With 1×/day, first velocity reading takes 24h
-- and acceleration takes 48h to materialise.
--
-- This migration reschedules to 4×/day at 03:30, 09:30, 15:30, 21:30 UTC.
-- That gives:
--   - First velocity reading: 6h after upload (vs 24h before)
--   - First acceleration reading: 12h after upload (vs 48h before)
--   - 4× the snapshot density → much sharper trend detection
--
-- QUOTA ANALYSIS:
-- 104 channels × 25 videos / 50 per call ≈ 52 quota units per scan run.
-- 52 × 4 ticks/day = 208 quota units/day on snapshots.
-- YouTube Data API daily limit: 10,000 units/key (we have 2 keys = 20,000).
-- Headroom remains for discover (~500 units/day) + ad-hoc lookups.
--
-- IDEMPOTENCY:
-- `cron.unschedule` first (safe if job missing — wrapped in DO block to
-- swallow not-found error), then `cron.schedule` to (re-)create with the new
-- expression. `cron.schedule` is upsert-by-jobname so re-runs are no-ops.

DO $$
BEGIN
  -- Unschedule old job; ignore "not found" if it was never scheduled.
  BEGIN
    PERFORM cron.unschedule('daily-scan');
    RAISE NOTICE 'unscheduled daily-scan (old 1×/day cadence)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'daily-scan was not previously scheduled (skipping unschedule)';
  END;
END $$;

-- Reschedule scan: 4×/day at 30 minutes past 03:00, 09:00, 15:00, 21:00 UTC.
-- Same job name retained so monitoring + cron.job_run_details history stays
-- linked to a single logical job.
SELECT cron.schedule(
  'daily-scan',
  '30 */6 * * *',
  $$ SELECT public.invoke_edge_function('scan'); $$
);

-- Verify after applying:
--   SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'daily-scan';
--   → schedule should read '30 */6 * * *'
