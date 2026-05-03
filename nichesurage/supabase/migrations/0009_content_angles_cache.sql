-- Cache table for AI-generated content angles per niche scan result.
-- 7-day TTL mirrors the niche_health_checks pattern. Keyed by scan_result_id
-- so re-scans of the same channel get fresh ideas.
create table if not exists public.content_angles_cache (
  scan_result_id uuid primary key references public.scan_results(id) on delete cascade,
  angles jsonb not null,
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index if not exists idx_content_angles_expires
  on public.content_angles_cache (expires_at);

alter table public.content_angles_cache enable row level security;

create policy "read content angles"
  on public.content_angles_cache for select
  to authenticated
  using (true);
