create table public.niche_health_checks (
  id uuid primary key default gen_random_uuid(),
  scan_result_id uuid not null references public.scan_results(id) on delete cascade,
  health_score int not null check (health_score between 0 and 100),
  components jsonb not null,
  verdict_text text not null,
  computed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (scan_result_id)
);

create index niche_health_checks_expires_idx on public.niche_health_checks(expires_at);

alter table public.niche_health_checks enable row level security;

create policy "Authenticated users can read health checks"
  on public.niche_health_checks for select
  to authenticated using (true);
