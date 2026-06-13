-- DOWN for 0068_revoke_anon_scan_results.sql
--
-- !! INSECURE -- THIS REOPENS C1 (the anon paywall-bypass). !!
-- It restores anon SELECT on scan_results' identity columns and on the derived
-- read surfaces (scan_results_latest, channel_spike_history_30d,
-- channel_current_momentum -- all of which expose youtube_channel_id and
-- channel identity). Use ONLY as an emergency rollback, and prefer fixing
-- forward. authenticated / service_role grants were never revoked by 0068, so
-- they are untouched here.

drop policy if exists "scan results readable by authenticated" on public.scan_results;

create policy "scan results readable by all"
  on public.scan_results
  for select
  to anon, authenticated
  using (true);

grant select on public.scan_results             to anon;
grant select on public.scan_results_latest       to anon;
grant select on public.channel_spike_history_30d to anon;
grant select on public.channel_current_momentum  to anon;
