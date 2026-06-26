-- 0069_public_landing_niches_active_only_DOWN.sql
-- Rollback for 0069: restore the exact 0067 public_landing_niches() definition
-- (reads scan_results directly, no channels_watchlist JOIN / is_active gate).
--
-- DEPLOY: apply manually in the Supabase SQL editor.

create or replace function public.public_landing_niches()
returns table (
  id                uuid,
  channel_num       integer,
  opportunity_score integer,
  virality_rating   text,
  spike_multiplier  double precision,
  engagement_rate   double precision,
  views_48h         bigint,
  views_avg         bigint,
  subscriber_count  integer,
  video_count       integer,
  content_type      text,
  language          text,
  is_spike          boolean,
  outlier_ratio     numeric,
  cluster_id        uuid,
  scanned_at        timestamptz
)
language sql
stable
security definer
set search_path = ''
as $func$
  with latest as (
    select distinct on (sr.youtube_channel_id)
           sr.id,
           sr.youtube_channel_id,
           sr.opportunity_score,
           sr.virality_rating,
           sr.spike_multiplier,
           sr.engagement_rate,
           sr.views_48h,
           sr.views_avg,
           sr.subscriber_count,
           sr.video_count,
           sr.content_type,
           sr.language,
           sr.is_spike,
           sr.outlier_ratio,
           sr.cluster_id,
           sr.scanned_at
      from public.scan_results sr
     order by sr.youtube_channel_id, sr.scanned_at desc
  )
  select
    l.id,
    ((pg_catalog.abs(pg_catalog.hashtext(l.id::text)::bigint) % 900) + 100)::integer
      as channel_num,
    l.opportunity_score,
    l.virality_rating::text as virality_rating,
    l.spike_multiplier,
    l.engagement_rate,
    l.views_48h,
    l.views_avg,
    l.subscriber_count,
    l.video_count,
    l.content_type,
    l.language::text as language,
    l.is_spike,
    l.outlier_ratio,
    l.cluster_id,
    l.scanned_at
  from latest l
  where (l.content_type = 'shorts'   and l.subscriber_count >= 5000)
     or (l.content_type = 'longform' and l.subscriber_count >= 2000);
$func$;

revoke all on function public.public_landing_niches() from public;
grant execute on function public.public_landing_niches() to anon, authenticated;
