-- 0022_replace_seed_keywords_2026.sql
--
-- Sprint A.8 follow-up: replace 2023-era generic seeds (AI Automation Tools,
-- Stoic Philosophy, Digital Minimalism, etc.) with 2026 trend-validated niches
-- sourced from X/Twitter YouTube community analysis. The old seeds were too
-- broad — searching "AI Automation Tools" returns MKBHD-tier already-big
-- channels, not the small premium-spike candidates we want.
--
-- All new seeds are LONGFORM. Shorts seeds will be added in a follow-up
-- migration after dedicated shorts research; existing shorts watchlist
-- continues to be scanned in the meantime.
--
-- Niches (longform):
--   1. AI Business Automation / Agentic Workflows (Nick Saraev tier)
--   2. Extinct / Prehistoric (ExtinctZoo signature)
--   3. Dark History / Mini-Doc / True Crime
--   4. Shopping Deals / Costco Hacks (The Deal Guy)
--   5. Amazon KDP / Self-Publishing (Sean Dollwet)
--   6. Quiz / Trivia (Quiz Plug)
--   7. Music Production Deconstruction
--   8. Cross-niche premium-spike title patterns (catch-all)

-- Step 1: Deactivate all current EN seeds. The DE seeds were already
-- deactivated by 0021 — this is a clean reset of the EN seed pool.
UPDATE seed_keywords
SET is_active = false
WHERE language = 'en'
  AND is_active = true;

-- Step 2: Insert new niche-specific seeds.
INSERT INTO seed_keywords (term, language, content_type, priority) VALUES
  -- ── Niche 1: AI Business Automation / Agentic Workflows ──
  ('AI Automation Agency',                                'en', 'longform', 100),
  ('Agentic Workflows',                                   'en', 'longform', 100),
  ('Build and Sell AI Automations',                       'en', 'longform', 100),
  ('How to Sell AI Automation',                           'en', 'longform',  95),
  ('n8n automation agency',                               'en', 'longform',  95),
  ('Make.com automation agency',                          'en', 'longform',  95),
  ('Claude Code automation',                              'en', 'longform',  90),
  ('I Studied 200 Automation Agencies',                   'en', 'longform',  90),

  -- ── Niche 2: Extinct / Prehistoric ──
  ('Prehistoric Creatures You Are Glad Are Extinct',      'en', 'longform',  95),
  ('Strangest Extinct Creatures Ever Found',              'en', 'longform',  90),
  ('Extinct nightmare creatures',                         'en', 'longform',  85),
  ('Giants Were Alive Just Years Ago',                    'en', 'longform',  85),

  -- ── Niche 3: Dark History / Mini-Doc / True Crime ──
  ('Dark History of',                                     'en', 'longform',  95),
  ('Twisted Conspiracies',                                'en', 'longform',  90),
  ('Disturbing Historical Tales',                         'en', 'longform',  90),
  ('The Truth is More Terrifying',                        'en', 'longform',  85),
  ('Ghosts of Highway',                                   'en', 'longform',  80),

  -- ── Niche 4: Shopping Deals / Costco Hacks ──
  ('Costco Deals You NEED To Buy',                        'en', 'longform',  85),
  ('Costco Shopping Secrets',                             'en', 'longform',  85),
  ('Things You SHOULD Be Buying at Costco',               'en', 'longform',  80),
  ('Costco price tag secrets',                            'en', 'longform',  80),

  -- ── Niche 5: Amazon KDP / Self-Publishing ──
  ('Things I Wish I Knew BEFORE Starting Amazon KDP',     'en', 'longform',  85),
  ('Amazon KDP book roast',                               'en', 'longform',  85),
  ('No BS Amazon KDP',                                    'en', 'longform',  80),
  ('KDP scaled to five figure',                           'en', 'longform',  80),

  -- ── Niche 6: Quiz / Trivia (Quiz Plug — could trend on shorts later) ──
  ('Guess the Logo in 3 Seconds',                         'en', 'longform',  80),
  ('400 Famous Logos',                                    'en', 'longform',  75),
  ('ONLY A GENIUS CAN SOLVE THESE RIDDLES',               'en', 'longform',  75),
  ('Guess the Snack Logo',                                'en', 'longform',  70),

  -- ── Niche 7: Music Production Deconstruction ──
  ('Deconstructing a Full Track',                         'en', 'longform',  75),
  ('Music Producer Deconstructs',                         'en', 'longform',  75),
  ('Song Deconstructions',                                'en', 'longform',  70),

  -- ── Cross-niche signature title patterns (catch-all) ──
  ('Here is What Works In 2026',                          'en', 'longform',  70),
  ('I Studied 200',                                       'en', 'longform',  65),
  ('Real Revenue How I Hit',                              'en', 'longform',  65),
  ('Step-by-Step First Timers',                           'en', 'longform',  60);
