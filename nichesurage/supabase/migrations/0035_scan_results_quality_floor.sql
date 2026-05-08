-- Quality floor on scan_results_latest: hide micro-channels (<1000 subs).
--
-- Rationale (2026-05-08): /discover top was being polluted by sub-1K
-- channels with absurd outlier_ratios. The opportunity_score formula
-- in metrics.ts rewards "small + new" with up to 60 free points
-- (sizeScore + ageScore), so a 21-sub channel with one 200-view video
-- could land at 93/EXCELLENT and trigger the SPIKING NOW badge while
-- being completely unremarkable in absolute terms (a 17x outlier on a
-- 21-sub baseline is mathematical noise, not a signal).
--
-- Filter is applied AFTER `distinct on` so we look at each channel's
-- current state, not historical snapshots — a channel that drops
-- below 1K should disappear, not surface its older row.
--
-- Filtering at the view layer (not the scan layer) keeps the raw
-- scan_results table intact for debug/admin queries; only the
-- discover-facing view hides them.

drop view if exists public.scan_results_latest cascade;

create view public.scan_results_latest as
  with latest as (
    select distinct on (youtube_channel_id) *
      from public.scan_results
     order by youtube_channel_id, scanned_at desc
  )
  select *
    from latest
   where subscriber_count >= 1000;
