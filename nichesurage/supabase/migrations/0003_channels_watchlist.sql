-- supabase/migrations/0003_channels_watchlist.sql
create table public.channels_watchlist (
  id uuid primary key default gen_random_uuid(),
  youtube_channel_id text not null unique,
  channel_name text not null,
  niche_label text not null default '',
  content_type text not null check (content_type in ('shorts', 'longform')),
  language text not null check (language in ('en', 'de')),
  first_discovered_at timestamptz not null default now(),
  last_scanned_at timestamptz,
  is_active boolean not null default true
);

alter table public.channels_watchlist enable row level security;

create policy "Authenticated users can read watchlist" on public.channels_watchlist
  for select using (auth.role() = 'authenticated');

create policy "Service role can insert watchlist" on public.channels_watchlist
  for insert with check (true);

create policy "Service role can update watchlist" on public.channels_watchlist
  for update using (true);
