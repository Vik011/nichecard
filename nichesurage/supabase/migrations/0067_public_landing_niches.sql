-- 0067_public_landing_niches.sql
-- PR-C.1 (ADDITIVE step). Safe public projection for the logged-out landing
-- teaser.
--
-- SECURITY DEFINER so the function can compute latest-per-channel internally
-- (DISTINCT ON youtube_channel_id) WITHOUT ever exposing an identity column.
-- The RETURNS TABLE enumerates ONLY non-identity columns -- never SETOF
-- public.scan_results, never sr.* (not even inside the CTE). The CTE selects
-- only the columns the projection needs plus youtube_channel_id, which is used
-- solely for DISTINCT ON / ORDER BY and is NOT returned.
--
-- channel_num is a deterministic 3-digit display label seeded from the OPAQUE
-- scan_results.id (a uuid), NOT from youtube_channel_id. hashtext is cast to
-- bigint before abs() so the int4-min edge case (abs(-2147483648)) cannot
-- overflow.
--
-- Never returned: channel_name, channel_url, youtube_channel_id, niche_label,
-- outlier_video_id, outlier_video_title, outlier_video_views,
-- channel_created_at, seed_keyword, embedding, and all premium/internal noise.
--
-- ORDER: this file is ADDITIVE and safe to apply BEFORE the landing code
-- deploys -- it only CREATEs a function and GRANTs EXECUTE; it revokes
-- nothing. The destructive anon revokes live in 0068 and must be applied
-- only AFTER the new landing code is live in production (see 0068 header).
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

-- Least privilege: CREATE FUNCTION grants EXECUTE to PUBLIC by default, so
-- revoke that first, then grant only to the two web roles. service_role does
-- not need it (it bypasses RLS and reads the base table directly).
revoke all on function public.public_landing_niches() from public;
grant execute on function public.public_landing_niches() to anon, authenticated;

-- Verify after applying:
--   1. select * from public.public_landing_niches() limit 1;
--      -> returns rows; column list contains NO identity column.
--   2. select has_function_privilege('anon',
--        'public.public_landing_niches()','EXECUTE');  -> true
--   3. begin; set local role anon;
--        select * from public.public_landing_niches() limit 1;  -> rows
--      rollback;
