-- 0069_public_landing_niches_active_only.sql
-- Fix: dead/terminated channels could appear on the logged-out landing teaser.
--
-- The 0067 public_landing_niches() RPC read public.scan_results directly and
-- filtered ONLY by subscriber_count. It never consulted channels_watchlist, so a
-- channel that was deactivated (is_active=false) or evicted (evicted_at set) —
-- e.g. a YouTube-terminated channel — still surfaced as a "Hidden Channel #NNN"
-- teaser. The in-app feed already excludes these via getAllowedChannelIds
-- (src/lib/discover/channelGate.ts); this aligns the anon landing path with the
-- same is_active + evicted_at gate.
--
-- channels_watchlist.youtube_channel_id is UNIQUE (0003), so the JOIN is 1:1 and
-- does not multiply rows or change the DISTINCT ON (sr.youtube_channel_id)
-- semantics. Everything else (security definer, search_path, projection, the
-- subscriber_count floor, channel_num derivation, grants) is byte-for-byte 0067.
--
-- NOTE: faceless_verdict is intentionally NOT filtered here — the landing teaser
-- is a deliberately broader anonymised marketing surface than the in-app feed
-- (the in-app gate adds faceless). The dead-channel fix needs only is_active +
-- evicted_at.
--
-- DEPLOY: apply manually in the Supabase SQL editor (no db push / CI). Safe to
-- apply any time — it only CREATE OR REPLACEs the function; revokes/grants are
-- re-asserted identically to 0067.

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

-- Re-assert least-privilege grants (identical to 0067).
revoke all on function public.public_landing_niches() from public;
grant execute on function public.public_landing_niches() to anon, authenticated;

-- Verify after applying:
--   1. select * from public.public_landing_niches() limit 1;
--      -> returns rows; column list contains NO identity column.
--   2. A known evicted channel's row must NOT appear:
--      select count(*) from public.public_landing_niches() p
--        join public.scan_results sr on sr.id = p.id
--       where sr.youtube_channel_id = 'UCDnFxTDr5gxvBf1q2iRSfSw'; -> 0
--   3. begin; set local role anon;
--        select * from public.public_landing_niches() limit 1;  -> rows
--      rollback;
