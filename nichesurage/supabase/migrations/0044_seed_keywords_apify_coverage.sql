-- 0044_seed_keywords_apify_coverage.sql
--
-- Coverage-driven Apify discovery engine (Sprint C) needs at least one seed
-- keyword per category to build YouTube search queries. Without seeds in a
-- category the pipeline generates zero queries for that bucket and channels
-- in that niche are never discovered.
--
-- Pre-migration distribution (EN, is_active=true), including 0041 contributions:
--   education_howto   13  (from 0038)
--   finance           21  (13 from 0038 + 8 shorts from 0041)
--   ai_tools           9  (from 0038)
--   true_crime         6  (from 0038)
--   gaming_streamers   4  (from 0038)
--   self_improvement   6  (1 from 0038 + 5 shorts from 0041)
--   fitness_health    12  (12 shorts from 0041; no prior longform)
--   luxury_lifestyle  10  (10 shorts from 0041; no prior longform)
--   crypto             0  (EMPTY)
--   tech_reviews       0  (EMPTY)
--   celebrity_drama    0  (EMPTY)
--   geopolitics_news   0  (EMPTY)
--
-- This migration adds content_type='both' seeds (priority 75) covering all
-- empty categories (12-15 seeds each) and tops up three thin categories:
--   gaming_streamers  +8
--   true_crime        +6
--   self_improvement  +12
--
-- Healthy categories (ai_tools, finance, education_howto) are left untouched.
--
-- Term style follows the phrasing convention from 0038 and 0041: a mix of
-- viral-hook title fragments and evergreen topic phrases that produce good
-- precision in YouTube search.list?q= for emerging creator content.

INSERT INTO seed_keywords (term, language, content_type, priority, category) VALUES

  -- crypto (14 new) --------------------------------------------------------
  ('Bitcoin price prediction',                'en', 'both', 75, 'crypto'),
  ('crypto market crash',                     'en', 'both', 75, 'crypto'),
  ('how to buy Bitcoin for beginners',        'en', 'both', 75, 'crypto'),
  ('Ethereum explained',                      'en', 'both', 75, 'crypto'),
  ('best altcoins to buy',                    'en', 'both', 75, 'crypto'),
  ('crypto portfolio review',                 'en', 'both', 75, 'crypto'),
  ('DeFi explained simply',                   'en', 'both', 75, 'crypto'),
  ('NFT market is dead',                      'en', 'both', 75, 'crypto'),
  ('I invested in crypto and lost everything','en', 'both', 75, 'crypto'),
  ('on-chain data analysis',                  'en', 'both', 75, 'crypto'),
  ('crypto whale moves',                      'en', 'both', 75, 'crypto'),
  ('Bitcoin halving explained',               'en', 'both', 75, 'crypto'),
  ('meme coin season',                        'en', 'both', 75, 'crypto'),
  ('Web3 project deep dive',                  'en', 'both', 75, 'crypto'),

  -- tech_reviews (14 new) --------------------------------------------------
  ('best budget smartphone',                  'en', 'both', 75, 'tech_reviews'),
  ('iPhone vs Android',                       'en', 'both', 75, 'tech_reviews'),
  ('laptop review',                           'en', 'both', 75, 'tech_reviews'),
  ('is the new MacBook worth it',             'en', 'both', 75, 'tech_reviews'),
  ('best tech under $100',                    'en', 'both', 75, 'tech_reviews'),
  ('gaming PC build guide',                   'en', 'both', 75, 'tech_reviews'),
  ('unboxing new gadgets',                    'en', 'both', 75, 'tech_reviews'),
  ('smart home setup tour',                   'en', 'both', 75, 'tech_reviews'),
  ('I bought the cheapest laptop on Amazon',   'en', 'both', 75, 'tech_reviews'),
  ('tech that actually changed my life',      'en', 'both', 75, 'tech_reviews'),
  ('headphones review',                       'en', 'both', 75, 'tech_reviews'),
  ('monitor review ultrawide',                'en', 'both', 75, 'tech_reviews'),
  ('this gadget surprised me',                'en', 'both', 75, 'tech_reviews'),
  ('best productivity apps',                  'en', 'both', 75, 'tech_reviews'),

  -- fitness_health (13 new longform/both) ----------------------------------
  ('body recomposition explained',            'en', 'both', 75, 'fitness_health'),
  ('I worked out every day for 30 days',      'en', 'both', 75, 'fitness_health'),
  ('full body workout at home',               'en', 'both', 75, 'fitness_health'),
  ('how to build muscle fast',                'en', 'both', 75, 'fitness_health'),
  ('weight loss transformation',              'en', 'both', 75, 'fitness_health'),
  ('what I eat in a week',                    'en', 'both', 75, 'fitness_health'),
  ('intermittent fasting results',            'en', 'both', 75, 'fitness_health'),
  ('doctor reacts to fitness myths',          'en', 'both', 75, 'fitness_health'),
  ('running for beginners plan',              'en', 'both', 75, 'fitness_health'),
  ('sleep optimization science',              'en', 'both', 75, 'fitness_health'),
  ('mental health tips that work',            'en', 'both', 75, 'fitness_health'),
  ('supplements actually worth taking',       'en', 'both', 75, 'fitness_health'),
  ('cold plunge benefits',                    'en', 'both', 75, 'fitness_health'),

  -- luxury_lifestyle (13 new longform/both) --------------------------------
  ('spending a week in Dubai',                'en', 'both', 75, 'luxury_lifestyle'),
  ('I stayed at a 5 star hotel',              'en', 'both', 75, 'luxury_lifestyle'),
  ('luxury car review',                       'en', 'both', 75, 'luxury_lifestyle'),
  ('private jet experience',                  'en', 'both', 75, 'luxury_lifestyle'),
  ('designer haul',                           'en', 'both', 75, 'luxury_lifestyle'),
  ('expensive vs cheap',                      'en', 'both', 75, 'luxury_lifestyle'),
  ('millionaire morning routine',             'en', 'both', 75, 'luxury_lifestyle'),
  ('rich people habits',                      'en', 'both', 75, 'luxury_lifestyle'),
  ('high end restaurant review',              'en', 'both', 75, 'luxury_lifestyle'),
  ('penthouse apartment tour',                'en', 'both', 75, 'luxury_lifestyle'),
  ('how the ultra rich spend money',          'en', 'both', 75, 'luxury_lifestyle'),
  ('yacht trip vlog',                         'en', 'both', 75, 'luxury_lifestyle'),
  ('luxury watch collection',                 'en', 'both', 75, 'luxury_lifestyle'),

  -- celebrity_drama (14 new) -----------------------------------------------
  ('celebrity drama explained',              'en', 'both', 75, 'celebrity_drama'),
  ('the rise and fall of',                   'en', 'both', 75, 'celebrity_drama'),
  ('celebrity beef breakdown',               'en', 'both', 75, 'celebrity_drama'),
  ('Hollywood scandal',                      'en', 'both', 75, 'celebrity_drama'),
  ('influencer exposed',                     'en', 'both', 75, 'celebrity_drama'),
  ('YouTuber drama recap',                   'en', 'both', 75, 'celebrity_drama'),
  ('celebrity went broke',                   'en', 'both', 75, 'celebrity_drama'),
  ('award show moments gone wrong',          'en', 'both', 75, 'celebrity_drama'),
  ('pop star cancelled',                     'en', 'both', 75, 'celebrity_drama'),
  ('behind the scenes Hollywood',            'en', 'both', 75, 'celebrity_drama'),
  ('reality TV drama',                       'en', 'both', 75, 'celebrity_drama'),
  ('celebrity interview went wrong',         'en', 'both', 75, 'celebrity_drama'),
  ('exposed fake celebrity',                 'en', 'both', 75, 'celebrity_drama'),
  ('TikTok influencer drama',               'en', 'both', 75, 'celebrity_drama'),

  -- geopolitics_news (14 new) -----------------------------------------------
  ('geopolitics explained simply',           'en', 'both', 75, 'geopolitics_news'),
  ('why this country is collapsing',         'en', 'both', 75, 'geopolitics_news'),
  ('US China conflict explained',            'en', 'both', 75, 'geopolitics_news'),
  ('war in Ukraine update',                  'en', 'both', 75, 'geopolitics_news'),
  ('Middle East conflict breakdown',         'en', 'both', 75, 'geopolitics_news'),
  ('NATO explained',                         'en', 'both', 75, 'geopolitics_news'),
  ('sanctions explained economics',          'en', 'both', 75, 'geopolitics_news'),
  ('election interference documentary',      'en', 'both', 75, 'geopolitics_news'),
  ('why the economy is broken',              'en', 'both', 75, 'geopolitics_news'),
  ('global debt crisis',                     'en', 'both', 75, 'geopolitics_news'),
  ('country power ranking',                  'en', 'both', 75, 'geopolitics_news'),
  ('BRICS vs dollar explained',              'en', 'both', 75, 'geopolitics_news'),
  ('news you missed this week',              'en', 'both', 75, 'geopolitics_news'),
  ('political scandal exposed',              'en', 'both', 75, 'geopolitics_news'),

  -- gaming_streamers top-up (+8) -------------------------------------------
  ('Fortnite best plays',                    'en', 'both', 75, 'gaming_streamers'),
  ('streamer reacts to',                     'en', 'both', 75, 'gaming_streamers'),
  ('viral gaming moments',                   'en', 'both', 75, 'gaming_streamers'),
  ('speedrun world record',                  'en', 'both', 75, 'gaming_streamers'),
  ('new game review',                        'en', 'both', 75, 'gaming_streamers'),
  ('gaming setup tour',                      'en', 'both', 75, 'gaming_streamers'),
  ('I played the hardest game',              'en', 'both', 75, 'gaming_streamers'),
  ('worst game ever made',                   'en', 'both', 75, 'gaming_streamers'),

  -- true_crime top-up (+6) -------------------------------------------------
  ('unsolved murder case',                   'en', 'both', 75, 'true_crime'),
  ('serial killer documentary',              'en', 'both', 75, 'true_crime'),
  ('cold case solved',                       'en', 'both', 75, 'true_crime'),
  ('cults explained',                        'en', 'both', 75, 'true_crime'),
  ('true crime deep dive',                   'en', 'both', 75, 'true_crime'),
  ('criminal mastermind story',              'en', 'both', 75, 'true_crime'),

  -- self_improvement top-up (+12) ------------------------------------------
  ('book summary that changed my life',      'en', 'both', 75, 'self_improvement'),
  ('atomic habits explained',               'en', 'both', 75, 'self_improvement'),
  ('stoicism for beginners',                'en', 'both', 75, 'self_improvement'),
  ('how to build discipline',               'en', 'both', 75, 'self_improvement'),
  ('morning routine for success',           'en', 'both', 75, 'self_improvement'),
  ('dopamine detox explained',              'en', 'both', 75, 'self_improvement'),
  ('how to stop procrastinating',           'en', 'both', 75, 'self_improvement'),
  ('journaling changed my life',            'en', 'both', 75, 'self_improvement'),
  ('how to talk to anyone',                 'en', 'both', 75, 'self_improvement'),
  ('networking tips that work',             'en', 'both', 75, 'self_improvement'),
  ('learn anything faster',                 'en', 'both', 75, 'self_improvement'),
  ('how to be more confident',              'en', 'both', 75, 'self_improvement')

ON CONFLICT DO NOTHING;

-- Verify after applying:
--   SELECT category, COUNT(*) FROM seed_keywords WHERE is_active AND language='en' GROUP BY category ORDER BY 2 DESC;
--   Expected totals (pre-0044 baseline + this migration):
--     finance           21  (21 pre-existing; unchanged by this migration)
--     fitness_health    25  (12 from 0041 + 13 new both)
--     luxury_lifestyle  23  (10 from 0041 + 13 new both)
--     education_howto   13  (unchanged)
--     crypto            14  (14 new)
--     tech_reviews      14  (14 new)
--     celebrity_drama   14  (14 new)
--     geopolitics_news  14  (14 new)
--     true_crime        12  (6 from 0038 + 6 new)
--     gaming_streamers  12  (4 from 0038 + 8 new)
--     self_improvement  18  (6 pre-existing from 0038+0041 + 12 new)
--     ai_tools           9  (unchanged)
