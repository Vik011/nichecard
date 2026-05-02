-- Sonar fix: Postgres expands `select *` into explicit columns at view CREATE
-- time, so the latest-view from 0004 still references only the pre-Sonar
-- column set and silently drops outlier_ratio / is_spike / cluster_id /
-- outlier_video_* / window_hours / seed_keyword / embedding.
-- Drop + recreate so it picks up the full Sonar shape.
drop view if exists public.scan_results_latest cascade;

create view public.scan_results_latest as
  select distinct on (youtube_channel_id) *
    from public.scan_results
   order by youtube_channel_id, scanned_at desc;
