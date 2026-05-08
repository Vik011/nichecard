-- 0036_shorts_seed_keywords.sql
--
-- Sprint A.8 follow-up promised in 0022 ("Shorts seeds will be added in a
-- follow-up migration after dedicated shorts research"). Discover edge
-- function has been running without ANY active shorts seeds since 0021
-- deactivated the DE shorts entries — every channel in the watchlist
-- arrived via longform-only search, which left the shorts-tier scan_results
-- pool starved.
--
-- 2026-05-08: Premium /discover after the <1K subs view filter (PR #49)
-- showed only ~50 niches total. Per user, two priorities:
--   1. Gaming / youth shorts categories (Minecraft, Roblox, streamer clips
--      compilations) — these dominate watch-time on shorts, and SurgeNiche
--      had zero seed coverage for them.
--   2. Mirror existing longform niches as shorts seeds where the topic
--      naturally compresses to short-form (dark history facts, prehistoric
--      animal facts, AI tips, costco deals, quiz/riddle, satisfying).
--
-- Priority scheme matches 0022: gaming/youth seeds priority 95 (highest
-- expected throughput), longform-mirrored seeds 85-90, satisfying re-seeded
-- at 75 to revive the deactivated entry from 0013 with a fresh
-- last_used_at=NULL position in the rotation.

INSERT INTO seed_keywords (term, language, content_type, priority) VALUES
  -- Gaming / youth shorts
  ('Minecraft Shorts',                                   'en', 'shorts', 95),
  ('Roblox Shorts',                                      'en', 'shorts', 95),
  ('Twitch Streamer Clips',                              'en', 'shorts', 95),
  ('Streamer Funny Moments',                             'en', 'shorts', 90),

  -- Mirror longform niches as shorts (priority slightly below gaming)
  ('Dark History Shorts',                                'en', 'shorts', 90),
  ('Prehistoric Animal Facts',                           'en', 'shorts', 85),
  ('AI Hack Shorts',                                     'en', 'shorts', 85),
  ('Costco Deal Shorts',                                 'en', 'shorts', 80),
  ('Riddle Shorts',                                      'en', 'shorts', 80),

  -- Revival of pre-2022 satisfying seed (deactivated by 0021/0022 reset)
  ('Satisfying Shorts',                                  'en', 'shorts', 75)
ON CONFLICT DO NOTHING;
