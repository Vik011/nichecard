-- Per-channel cache of the 12 most recent uploads, used by the ChannelVideoGrid
-- on the niche detail page. 24h TTL; the API route falls back to stale cache
-- if YouTube quota is exhausted.
create table if not exists public.channel_recent_videos (
  youtube_channel_id text primary key,
  videos jsonb not null,
  fetched_at timestamptz not null default now()
);

create index if not exists idx_channel_recent_videos_fetched
  on public.channel_recent_videos (fetched_at);

alter table public.channel_recent_videos enable row level security;

create policy "read recent videos"
  on public.channel_recent_videos for select
  to anon, authenticated
  using (true);
