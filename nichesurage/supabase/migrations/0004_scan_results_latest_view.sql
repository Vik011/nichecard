create or replace view scan_results_latest as
select distinct on (youtube_channel_id) *
from scan_results
order by youtube_channel_id, scanned_at desc;
