-- Sonar: wipe legacy data + install retention cron.
-- Locked decision: drop the noise pre-Sonar so /discover only ever shows
-- premium outlier results.

-- 1) Wipe legacy scans + watchlist. Bookmarks (user_saved_niches) become orphans;
--    accepted risk per spec.
truncate table public.scan_results cascade;
truncate table public.channels_watchlist cascade;

-- 2) Retention function: prune stale rows so the DB stays "fresh".
--    - non-spike rows older than RETENTION_NON_SPIKE_DAYS (default 14) are deleted
--    - spike rows older than RETENTION_SPIKE_DAYS (default 60) are deleted
--    - never delete a row referenced by user_saved_niches (bookmark safety net)
create or replace function public.prune_stale_scans(
  non_spike_days int default 14,
  spike_days int default 60
)
returns table (deleted_non_spike bigint, deleted_spike bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  ns bigint;
  s  bigint;
begin
  with deleted as (
    delete from public.scan_results sr
     where sr.is_spike = false
       and sr.scanned_at < now() - make_interval(days => non_spike_days)
       and not exists (
         select 1 from public.user_saved_niches usn
          where usn.scan_result_id = sr.id
       )
    returning 1
  )
  select count(*) into ns from deleted;

  with deleted as (
    delete from public.scan_results sr
     where sr.is_spike = true
       and sr.scanned_at < now() - make_interval(days => spike_days)
       and not exists (
         select 1 from public.user_saved_niches usn
          where usn.scan_result_id = sr.id
       )
    returning 1
  )
  select count(*) into s from deleted;

  return query select ns, s;
end;
$$;

-- 3) Cron: prune daily at 02:00 UTC (1h before discover so freshly pruned table
--    welcomes the new scan run).
select cron.schedule(
  'sonar-prune-stale',
  '0 2 * * *',
  $$ select public.prune_stale_scans(14, 60); $$
);
