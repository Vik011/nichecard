-- 0048_security_invoker_views.sql
--
-- Clears two CRITICAL Supabase Security Advisor findings: the views
-- `public.scan_results_latest` and `public.channel_spike_history_30d`
-- are defined with the SECURITY DEFINER property.
--
-- A view created without `security_invoker` runs with the privileges of
-- its OWNER (postgres), so it silently bypasses Row Level Security on the
-- underlying tables. The advisor flags this because it lets a caller read
-- rows their own RLS policies would deny.
--
-- THE CATCH: both views read `public.scan_results`, whose only RLS policy
-- (from 0001) is `for select using (auth.role() = 'authenticated')` -- it
-- does NOT allow `anon`. The public landing page (`/`) reads
-- `scan_results_latest` with the anon key (see fetchTopNiches.ts /
-- fetchRadarPings.ts via createStaticClient). It works TODAY only because
-- the SECURITY DEFINER view smuggles the rows past that RLS policy.
--
-- So flipping `security_invoker` on its own would break the landing page
-- for logged-out visitors -- the exact regression class 0019 fixed for
-- niche_clusters. The correct fix is therefore TWO changes together:
--
--   1. Open SELECT on `scan_results` to `anon` as well as `authenticated`.
--      scan_results holds YouTube niche-scan data, no user PII; it is
--      already anon-visible through the DEFINER view today, so this is
--      behaviour-preserving. INSERT/UPDATE stay service_role only.
--   2. Recreate both views with `security_invoker = on` so RLS is now
--      enforced explicitly instead of bypassed.
--
-- DEPLOY: apply manually in the Supabase SQL editor (no db push / CI in
-- this project). Order within this file is intentional: policy first,
-- then the views.

-- --- 1. scan_results: replace authenticated-only SELECT with anon+auth ----
-- Same drop+create pattern as 0019_niche_clusters_public_read.sql.

DROP POLICY IF EXISTS "Authenticated users can read scan results"
  ON public.scan_results;

CREATE POLICY "scan results readable by all"
  ON public.scan_results
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- --- 2a. scan_results_latest -> security_invoker --------------------------
-- Recreated (not ALTER ... SET) so the definition stays self-contained and
-- matches the current shape from 0040_quality_floor_v2.sql exactly.

DROP VIEW IF EXISTS public.scan_results_latest CASCADE;

CREATE VIEW public.scan_results_latest
  WITH (security_invoker = on) AS
  WITH latest AS (
    SELECT DISTINCT ON (youtube_channel_id) *
      FROM public.scan_results
     ORDER BY youtube_channel_id, scanned_at DESC
  )
  SELECT *
    FROM latest
   WHERE
     (content_type = 'shorts'   AND subscriber_count >= 5000)
     OR
     (content_type = 'longform' AND subscriber_count >= 2000);

GRANT SELECT ON public.scan_results_latest TO anon, authenticated, service_role;

-- --- 2b. channel_spike_history_30d -> security_invoker --------------------
-- Definition unchanged from 0008_channel_spike_history.sql; only the
-- security_invoker property is added.

DROP VIEW IF EXISTS public.channel_spike_history_30d CASCADE;

CREATE VIEW public.channel_spike_history_30d
  WITH (security_invoker = on) AS
SELECT
  youtube_channel_id,
  date_trunc('day', scanned_at)::date AS day,
  max(coalesce(spike_multiplier, 0))::numeric(10, 2) AS spike_x
FROM public.scan_results
WHERE scanned_at > now() - interval '30 days'
GROUP BY youtube_channel_id, date_trunc('day', scanned_at)
ORDER BY day ASC;

GRANT SELECT ON public.channel_spike_history_30d TO anon, authenticated, service_role;

-- Verify after applying:
--   1. Advisor: both "Security Definer View" findings clear.
--   2. security_invoker is on:
--      SELECT relname, reloptions FROM pg_class
--       WHERE relname IN ('scan_results_latest','channel_spike_history_30d');
--      -> reloptions must contain 'security_invoker=on' (or =true) for both.
--   3. anon can still read (this is the regression guard): from the
--      landing page logged-out, niche cards must still render -- or run a
--      REST GET on /rest/v1/scan_results_latest with the anon key and
--      confirm a non-empty 200 response.
