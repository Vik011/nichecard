-- Sonar: read-only RPC to inspect cron jobs from the public schema.
-- The cron schema is not exposed via PostgREST, so this is the only way to
-- verify scheduling from CLI/REST without psql.
create or replace function public.list_cron_jobs()
returns table (
  jobid bigint,
  jobname text,
  schedule text,
  command text,
  active boolean
)
language sql
security definer
set search_path = public, cron
as $$
  select j.jobid, j.jobname, j.schedule, j.command, j.active
    from cron.job j
   order by j.jobname asc;
$$;

-- Restrict execution to service_role (anon should never see system internals).
revoke all on function public.list_cron_jobs() from public, anon, authenticated;
grant execute on function public.list_cron_jobs() to service_role;
