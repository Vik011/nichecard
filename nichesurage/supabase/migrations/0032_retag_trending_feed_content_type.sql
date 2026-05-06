-- 0032: Retag trending_feed candidates with correct content_type.
--
-- WHY:
-- The first version of /api/discovery/trending hardcoded contentType:
-- 'longform' for every channel it inserted. This polluted the longform
-- tab with shorts-only creators (verified 2026-05-06: channels like
-- RasIND, Aslıda Ne?, Mario Facts surfaced as longform NicheCards but
-- their actual catalog is shorts).
--
-- The route was patched (next deploy) to detect content_type per channel
-- via videos.list contentDetails. This migration backfills the 151
-- already-mistagged trending_feed rows by inspecting their already-
-- ingested video_snapshots.
--
-- DECISION RULE:
-- For each trending_feed channel that has any video_snapshot:
--   - If ANY ingested video has duration_seconds in (0, 60] → mark 'shorts'
--   - Else (all snapshots > 60s) → mark 'longform'
--
-- Channels with no snapshots yet (~88 of 151) are LEFT alone. They will
-- be re-tagged the moment scan ingests their first video and the next
-- discovery loop runs.
--
-- This is idempotent: running it again produces the same result given
-- the same video_snapshots state.

UPDATE channels_watchlist
SET content_type = 'shorts'
WHERE discovered_via = 'trending_feed'
  AND content_type = 'longform'
  AND EXISTS (
    SELECT 1 FROM video_snapshots vs
    WHERE vs.channel_id = channels_watchlist.youtube_channel_id
      AND vs.duration_seconds IS NOT NULL
      AND vs.duration_seconds > 0
      AND vs.duration_seconds <= 60
  );

-- Channels with snapshots that are ALL longform (>60s): keep 'longform'.
-- This is a no-op cosmetic update — the trigger is just to mark these
-- rows as "verified longform" for future debugging clarity. Skip the
-- write if the value is already correct.
-- (Intentionally not implemented: above UPDATE only flips longform -> shorts.
--  Channels remain 'longform' if they had no shorts-duration snapshots.)

COMMENT ON COLUMN channels_watchlist.content_type IS
  'shorts | longform. As of migration 0032, trending_feed-discovered rows are tagged based on the matched search-result video duration (videos.list contentDetails). Rows with no snapshots default to longform until next scan ingests them.';
