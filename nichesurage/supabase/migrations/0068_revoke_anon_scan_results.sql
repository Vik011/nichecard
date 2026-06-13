-- 0068_revoke_anon_scan_results.sql
-- PR-C.1 (DESTRUCTIVE step). Closes C1 -- the anon paywall-bypass.
--
-- Before this migration, scan_results' only SELECT policy (0048) is
-- `TO anon, authenticated USING (true)`, and the security_invoker views
-- scan_results_latest / channel_spike_history_30d plus the materialized view
-- channel_current_momentum are GRANTed to anon. That lets a logged-out caller
-- read the full paid dataset -- channel_name, channel_url, youtube_channel_id,
-- niche_label, outlier_video_* -- straight off PostgREST with the public anon
-- key. This migration removes anon's access to all of those paths. The
-- logged-out landing teaser keeps working because it now reads the safe
-- public_landing_niches() RPC (0067) instead.
--
-- !! ORDER -- DO NOT APPLY until BOTH are true: !!
--   1. 0067 (public_landing_niches) is already applied in production.
--   2. The landing code reading the RPC (fetchTopNiches / fetchRadarPings) is
--      LIVE on Vercel Production.
-- Applying this before the new landing is live breaks the logged-out landing
-- page, which would still be reading scan_results_latest as anon.
--
-- SCOPE: anon ONLY. The authenticated /discover feed is untouched --
-- authenticated keeps full scan_results SELECT, so the security_invoker views
-- continue to resolve for logged-in users. No free-authenticated gating, no
-- channels_watchlist changes, no J3 video tables here (those are PR-C.2+).
--
-- DEPLOY: apply manually in the Supabase SQL editor (no db push / CI).

-- 1) scan_results base table: replace the anon+authenticated read policy with
--    an authenticated-only one, and revoke anon's table privilege.
drop policy if exists "scan results readable by all" on public.scan_results;

create policy "scan results readable by authenticated"
  on public.scan_results
  for select
  to authenticated
  using (true);

revoke select on public.scan_results from anon;

-- 2) Revoke anon on the derived read surfaces. scan_results_latest and
--    channel_spike_history_30d are security_invoker (0048), so they already go
--    dark for anon once the base SELECT above is gone; revoking the explicit
--    grants makes the lockdown explicit. channel_current_momentum is a
--    materialized view (no RLS) whose only gate is the grant, so this revoke
--    is what actually closes its youtube_channel_id exposure to anon.
revoke all on public.scan_results_latest       from anon;
revoke all on public.channel_spike_history_30d from anon;
revoke all on public.channel_current_momentum  from anon;

-- Verify after applying (see 0068_..._DOWN for the insecure rollback):
--   has_table_privilege ('anon','public.scan_results','SELECT')                       -> false
--   has_column_privilege('anon','public.scan_results','channel_name','SELECT')        -> false
--   has_column_privilege('anon','public.scan_results','youtube_channel_id','SELECT')  -> false
--   has_table_privilege ('anon','public.scan_results_latest','SELECT')                -> false
--   has_table_privilege ('anon','public.channel_current_momentum','SELECT')           -> false
--   has_table_privilege ('anon','public.channel_spike_history_30d','SELECT')          -> false
--   has_function_privilege('anon','public.public_landing_niches()','EXECUTE')         -> true
--   logged-out landing still renders niche cards; logged-in /discover unchanged.
