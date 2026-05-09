-- 0038_seed_keywords_category.sql
--
-- Add `category` taxonomy to seed_keywords. Sprint A.10 follow-up: discovery
-- pool was clustered around ~7 narrow themes (dark history, AI automation,
-- prehistoric, etc.) covering only fragments of YouTube creator audience.
--
-- Reuses the 12-value `category_enum` from 0024_trend_engine_schema.sql
-- (Sprint B trend engine), values: ai_tools, finance, crypto, tech_reviews,
-- gaming_streamers, fitness_health, self_improvement, true_crime,
-- luxury_lifestyle, celebrity_drama, geopolitics_news, education_howto.
-- Sprint B trend engine UI was deprecated in PR #47 but the enum + the
-- channels_watchlist.category column it added are still useful — we
-- repurpose them for /discover category filtering.
--
-- seed_keywords.category is TEXT (not enum-typed) so the application
-- enforces value validity at write time. Lets us add new categories later
-- without enum-altering DDL.

ALTER TABLE seed_keywords
  ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS seed_keywords_category_idx
  ON seed_keywords(category);

-- Backfill existing 47 EN keywords with category labels from category_enum.

-- ai_tools (9): all AI Automation seeds
UPDATE seed_keywords SET category = 'ai_tools' WHERE term IN (
  'AI Automation Agency',
  'Agentic Workflows',
  'Build and Sell AI Automations',
  'How to Sell AI Automation',
  'n8n automation agency',
  'Make.com automation agency',
  'Claude Code automation',
  'I Studied 200 Automation Agencies',
  'AI Hack Shorts'
);

-- true_crime (6): dark history, conspiracies, mystery-themed
UPDATE seed_keywords SET category = 'true_crime' WHERE term IN (
  'Dark History of',
  'Twisted Conspiracies',
  'Disturbing Historical Tales',
  'The Truth is More Terrifying',
  'Ghosts of Highway',
  'Dark History Shorts'
);

-- education_howto (13): prehistoric facts (educational), quiz, music decon
UPDATE seed_keywords SET category = 'education_howto' WHERE term IN (
  'Prehistoric Creatures You Are Glad Are Extinct',
  'Strangest Extinct Creatures Ever Found',
  'Extinct nightmare creatures',
  'Giants Were Alive Just Years Ago',
  'Prehistoric Animal Facts',
  'Guess the Logo in 3 Seconds',
  '400 Famous Logos',
  'ONLY A GENIUS CAN SOLVE THESE RIDDLES',
  'Guess the Snack Logo',
  'Deconstructing a Full Track',
  'Music Producer Deconstructs',
  'Song Deconstructions',
  'Riddle Shorts'
);

-- finance (13): Costco deals (deal-hunting), KDP (income), catch-all revenue
UPDATE seed_keywords SET category = 'finance' WHERE term IN (
  'Costco Deals You NEED To Buy',
  'Costco Shopping Secrets',
  'Things You SHOULD Be Buying at Costco',
  'Costco price tag secrets',
  'Costco Deal Shorts',
  'Things I Wish I Knew BEFORE Starting Amazon KDP',
  'Amazon KDP book roast',
  'No BS Amazon KDP',
  'KDP scaled to five figure',
  'Here is What Works In 2026',
  'I Studied 200',
  'Real Revenue How I Hit',
  'Step-by-Step First Timers'
);

-- gaming_streamers (4)
UPDATE seed_keywords SET category = 'gaming_streamers' WHERE term IN (
  'Minecraft Shorts',
  'Roblox Shorts',
  'Twitch Streamer Clips',
  'Streamer Funny Moments'
);

-- self_improvement (1): satisfying/relaxing content
UPDATE seed_keywords SET category = 'self_improvement' WHERE term IN (
  'Satisfying Shorts'
);

-- Verify after applying:
--   SELECT category, COUNT(*) FROM seed_keywords WHERE is_active=true AND language='en' GROUP BY category ORDER BY 2 DESC;
--   → ai_tools 9, education_howto 13, finance 13, true_crime 6, gaming_streamers 4, self_improvement 1
