-- Daily max spike per channel for the last 30 days, used by the Sparkline component.
create or replace view public.channel_spike_history_30d as
select
  youtube_channel_id,
  date_trunc('day', scanned_at)::date as day,
  max(coalesce(spike_multiplier, 0))::numeric(10, 2) as spike_x
from public.scan_results
where scanned_at > now() - interval '30 days'
group by youtube_channel_id, date_trunc('day', scanned_at)
order by day asc;

grant select on public.channel_spike_history_30d to anon, authenticated, service_role;
