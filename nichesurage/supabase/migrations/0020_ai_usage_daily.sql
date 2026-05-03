-- Sprint A.7 Phase 1: per-user daily AI usage counter.
--
-- Why a new table instead of counting niche_health_checks / content_angles_cache:
-- those are SHARED CACHES (one row per scan_result_id, reused across users).
-- They have no user dimension so they can't be the source of truth for
-- per-user quotas.
--
-- Why a (user_id, day) compound key instead of a counter column on users:
-- naturally partitioned, no reset logic, atomic UPSERT increment, and we get
-- a free 30-day usage history for free if we ever want to surface it.
create table if not exists public.ai_usage_daily (
  user_id uuid not null references public.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);

create index if not exists ai_usage_daily_recent_idx
  on public.ai_usage_daily (user_id, day desc);

alter table public.ai_usage_daily enable row level security;

-- Users can read their own usage row (needed for the "1/1 today" UI badge).
create policy "users see their own ai usage"
  on public.ai_usage_daily for select
  to authenticated
  using (user_id = auth.uid());

-- Writes go exclusively through the increment_ai_usage() RPC below, which
-- runs as security definer with explicit user_id arg. We don't grant
-- INSERT/UPDATE policies — the RPC is the only sanctioned write path.

-- Atomic UPSERT increment. Returns the new count so the caller can decide
-- whether to allow the AI run (count <= tier limit).
create or replace function public.increment_ai_usage(
  p_user_id uuid,
  p_day date
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.ai_usage_daily (user_id, day, count)
    values (p_user_id, p_day, 1)
    on conflict (user_id, day)
    do update set count = public.ai_usage_daily.count + 1
    returning count into v_count;
  return v_count;
end;
$$;

-- Allow authenticated users to call the function (it gates writes by the
-- caller's auth.uid() in the route handler — the function itself trusts
-- the caller, so the API route MUST pass auth.uid() as p_user_id, not
-- arbitrary input).
revoke all on function public.increment_ai_usage(uuid, date) from public;
grant execute on function public.increment_ai_usage(uuid, date) to authenticated, service_role;
