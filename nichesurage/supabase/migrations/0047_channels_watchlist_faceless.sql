-- 0047: Faceless classification verdict on discovered channels.
--
-- WHY:
-- NicheSurage's audience is faceless-channel creators: people who build
-- brand-style channels with no on-camera presenter (compilations, AI
-- voiceover, narration/documentary, screen recordings, animation,
-- listicles, text-on-screen). Discovery must therefore steer that
-- audience toward channels they can actually study and model.
--
-- The discover-ingest edge function now classifies every candidate
-- channel with a Claude-Haiku faceless classifier before inserting it.
-- Channels classified as FACE (a host/personality appears on camera)
-- are hard-rejected at ingest and never stored at all. This column
-- records the verdict for the channels that ARE stored:
--
--   true   : classified faceless (the desired channel shape)
--   false  : uncertain (kept, but the classifier could not confirm
--            faceless; also the value when no ANTHROPIC_API_KEY is set)
--
-- FACE channels are not represented here because they are dropped
-- before the INSERT ever runs.
--
-- Columns:
--   faceless : per-channel faceless classification verdict (see above)

ALTER TABLE channels_watchlist ADD COLUMN IF NOT EXISTS faceless boolean;

COMMENT ON COLUMN channels_watchlist.faceless IS
  'Faceless classification verdict: true = classified faceless, false = uncertain. FACE channels are rejected at ingest and never stored.';
