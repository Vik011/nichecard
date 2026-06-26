-- 0070_public_landing_niches_faceless_only.sql
-- Fix: the logged-out landing teaser stamps EVERY card with the label
-- "Faceless Shorts" / "Faceless Long-form" (src/lib/landing/fetchTopNiches.ts
-- coarseLabel + fetchRadarPings.ts), but the 0069 RPC filtered only is_active +
-- evicted_at — NOT faceless_verdict. So a channel classified `face` or
-- `uncertain` was shown to the public as "Faceless", an affirmative false claim
-- on the highest-traffic, signup-driving page.
--
-- 0069 deliberately omitted the faceless filter to keep the teaser a "broad"
-- pool, but that conflicts with the literal label. Aligning the pool with the
-- label is the honest fix: only genuinely-faceless channels appear, so the label
-- is truthful and the teaser matches the product promise.
--
-- Identical to 0069 except the CTE adds `and cw.faceless_verdict = 'faceless'`.
-- Everything else (security definer, search_path, projection, subscriber floor,
-- grants) is unchanged.
--
-- DEPLOY: apply manually in the Supabase SQL editor (no db push / CI).

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
      join public.channels_watchlist cw
        on cw.youtube_channel_id = sr.youtube_channel_id
     where cw.is_active = true
       and cw.evicted_at is null
       and cw.faceless_verdict = 'faceless'
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

-- Verify after applying:
--   1. select * from public.public_landing_niches() limit 1;  -> rows
--   2. every returned id maps to a faceless channel:
--      select count(*) from public.public_landing_niches() p
--        join public.scan_results sr on sr.id = p.id
--        join public.channels_watchlist cw on cw.youtube_channel_id = sr.youtube_channel_id
--       where cw.faceless_verdict <> 'faceless';  -> 0
