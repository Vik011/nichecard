create type user_tier as enum ('free', 'basic', 'premium');
create type virality_rating as enum ('excellent', 'good', 'average');
create type content_language as enum ('en', 'de');

-- Extended user profile (linked to Supabase auth.users)
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  tier user_tier not null default 'free',
  stripe_customer_id text,
  daily_searches_used int not null default 0,
  daily_searches_reset_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Niche scan results from hourly background job
create table public.scan_results (
  id uuid primary key default gen_random_uuid(),
  youtube_channel_id text not null,
  channel_name text not null,
  niche_label text not null,
  channel_url text not null,
  channel_created_at date not null,
  video_count int not null,
  subscriber_count int not null,
  views_48h bigint not null default 0,
  views_avg bigint not null default 0,
  spike_multiplier float not null default 0,
  engagement_rate float not null default 0,
  opportunity_score int not null default 0,
  virality_rating virality_rating not null default 'average',
  language content_language not null default 'en',
  scanned_at timestamptz not null default now()
);

-- Viral videos linked to a scan result
create table public.viral_videos (
  id uuid primary key default gen_random_uuid(),
  scan_result_id uuid references public.scan_results(id) on delete cascade not null,
  youtube_video_id text not null,
  title text not null,
  views bigint not null default 0,
  hook_analysis text,
  format_notes text
);

-- Niches saved by users (basic+)
create table public.user_saved_niches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  scan_result_id uuid references public.scan_results(id) on delete cascade not null,
  saved_at timestamptz not null default now(),
  unique(user_id, scan_result_id)
);

-- Row Level Security
alter table public.users enable row level security;
alter table public.scan_results enable row level security;
alter table public.viral_videos enable row level security;
alter table public.user_saved_niches enable row level security;

-- Users can only read/update their own profile
create policy "Users can view own profile" on public.users
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

-- All authenticated users can read scan results
create policy "Authenticated users can read scan results" on public.scan_results
  for select using (auth.role() = 'authenticated');

-- All authenticated users can read viral videos
create policy "Authenticated users can read viral videos" on public.viral_videos
  for select using (auth.role() = 'authenticated');

-- Users manage their own saved niches
create policy "Users manage own saved niches" on public.user_saved_niches
  for all using (auth.uid() = user_id);

-- Auto-create user profile on signup
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
