-- 0039_broaden_seed_keywords.sql
--
-- Sprint A.10 follow-up — broaden seed keyword universe to cover audience
-- verticals previously missing. Discord-shared pipeline used 90 keywords
-- across broad categories. We're adopting all 90 mapped to the existing
-- `category_enum` from 0024 (Sprint B trend engine schema).
--
-- Total after this migration: 47 existing + 90 new = 137 active EN seeds.
--
-- Distribution post-migration (12-cat enum, will be aggregated to 7 user-
-- facing chips in the /discover UI later):
--   ai_tools:          20  (9 + 11)
--   finance:           30  (13 + 17)
--   crypto:             1  (0 + 1)
--   fitness_health:    10  (0 + 10)
--   self_improvement:  17  (1 + 16)
--   education_howto:   29  (13 + 16)
--   gaming_streamers:   5  (4 + 1)
--   true_crime:         8  (6 + 2)
--   celebrity_drama:    3  (0 + 3)
--   luxury_lifestyle:  14  (0 + 14)
--
-- Priority tier: 70 (between catch-all 60 and themed 75-90). Lets the
-- existing themed seeds keep top rotation slots; new broad seeds rotate
-- in below.
--
-- All longform. Shorts seeds were added separately in 0036; we don't
-- duplicate them here.

INSERT INTO seed_keywords (term, language, content_type, priority, category) VALUES
  -- ── ai_tools (11 new) ──
  ('AI tools tutorial',         'en', 'longform', 70, 'ai_tools'),
  ('ChatGPT tips',              'en', 'longform', 70, 'ai_tools'),
  ('productivity apps',         'en', 'longform', 70, 'ai_tools'),
  ('coding for beginners',      'en', 'longform', 70, 'ai_tools'),
  ('tech explained',            'en', 'longform', 70, 'ai_tools'),
  ('AI automation',             'en', 'longform', 70, 'ai_tools'),
  ('software tutorial',         'en', 'longform', 70, 'ai_tools'),
  ('machine learning basics',   'en', 'longform', 70, 'ai_tools'),
  ('no code tutorial',          'en', 'longform', 70, 'ai_tools'),
  ('tech tips',                 'en', 'longform', 70, 'ai_tools'),
  ('graphic design tutorial',   'en', 'longform', 70, 'ai_tools'),

  -- ── finance (17 new) ──
  ('personal finance tips',     'en', 'longform', 70, 'finance'),
  ('stock market for beginners','en', 'longform', 70, 'finance'),
  ('real estate tips',          'en', 'longform', 70, 'finance'),
  ('passive income ideas',      'en', 'longform', 70, 'finance'),
  ('how to save money',         'en', 'longform', 70, 'finance'),
  ('dividend stocks',           'en', 'longform', 70, 'finance'),
  ('side hustle ideas',         'en', 'longform', 70, 'finance'),
  ('financial independence',    'en', 'longform', 70, 'finance'),
  ('budget tips',               'en', 'longform', 70, 'finance'),
  ('dropshipping tutorial',     'en', 'longform', 70, 'finance'),
  ('Amazon FBA beginner',       'en', 'longform', 70, 'finance'),
  ('print on demand',           'en', 'longform', 70, 'finance'),
  ('freelancing tips',          'en', 'longform', 70, 'finance'),
  ('how to start agency',       'en', 'longform', 70, 'finance'),
  ('SaaS startup',              'en', 'longform', 70, 'finance'),
  ('ecommerce tips',            'en', 'longform', 70, 'finance'),
  ('online business ideas',     'en', 'longform', 70, 'finance'),

  -- ── crypto (1 new) ──
  ('crypto investing',          'en', 'longform', 70, 'crypto'),

  -- ── fitness_health (10 new) ──
  ('weight loss tips',          'en', 'longform', 70, 'fitness_health'),
  ('home workout routine',      'en', 'longform', 70, 'fitness_health'),
  ('gym beginner',              'en', 'longform', 70, 'fitness_health'),
  ('meal prep ideas',           'en', 'longform', 70, 'fitness_health'),
  ('healthy eating',            'en', 'longform', 70, 'fitness_health'),
  ('mental health tips',        'en', 'longform', 70, 'fitness_health'),
  ('yoga for beginners',        'en', 'longform', 70, 'fitness_health'),
  ('running for beginners',     'en', 'longform', 70, 'fitness_health'),
  ('build muscle fast',         'en', 'longform', 70, 'fitness_health'),
  ('healthy recipes easy',      'en', 'longform', 70, 'fitness_health'),

  -- ── self_improvement (16 new) ──
  ('minimalist lifestyle',      'en', 'longform', 70, 'self_improvement'),
  ('morning routine',           'en', 'longform', 70, 'self_improvement'),
  ('self improvement tips',     'en', 'longform', 70, 'self_improvement'),
  ('stoicism explained',        'en', 'longform', 70, 'self_improvement'),
  ('journaling tips',           'en', 'longform', 70, 'self_improvement'),
  ('productivity tips',         'en', 'longform', 70, 'self_improvement'),
  ('digital nomad life',        'en', 'longform', 70, 'self_improvement'),
  ('van life tour',             'en', 'longform', 70, 'self_improvement'),
  ('tiny house tour',           'en', 'longform', 70, 'self_improvement'),
  ('slow living',               'en', 'longform', 70, 'self_improvement'),
  ('how to grow youtube',       'en', 'longform', 70, 'self_improvement'),
  ('personal brand tips',       'en', 'longform', 70, 'self_improvement'),
  ('budget travel tips',        'en', 'longform', 70, 'self_improvement'),
  ('solo travel tips',          'en', 'longform', 70, 'self_improvement'),
  ('slow travel',               'en', 'longform', 70, 'self_improvement'),
  ('book summary',              'en', 'longform', 70, 'self_improvement'),

  -- ── education_howto (15 new) ──
  ('learn language fast',       'en', 'longform', 70, 'education_howto'),
  ('study tips',                'en', 'longform', 70, 'education_howto'),
  ('history explained',         'en', 'longform', 70, 'education_howto'),
  ('science explained',         'en', 'longform', 70, 'education_howto'),
  ('philosophy explained',      'en', 'longform', 70, 'education_howto'),
  ('economics explained',       'en', 'longform', 70, 'education_howto'),
  ('law explained',             'en', 'longform', 70, 'education_howto'),
  ('psychology explained',      'en', 'longform', 70, 'education_howto'),
  ('facts explained',           'en', 'longform', 70, 'education_howto'),
  ('chess tips beginner',       'en', 'longform', 70, 'education_howto'),
  ('guitar lessons beginner',   'en', 'longform', 70, 'education_howto'),
  ('drawing tutorial',          'en', 'longform', 70, 'education_howto'),
  ('photography tips beginner', 'en', 'longform', 70, 'education_howto'),
  ('art tutorial',              'en', 'longform', 70, 'education_howto'),
  ('cooking easy',              'en', 'longform', 70, 'education_howto'),
  ('baking beginner',           'en', 'longform', 70, 'education_howto'),

  -- ── gaming_streamers (1 new) ──
  ('gaming tips',               'en', 'longform', 70, 'gaming_streamers'),

  -- ── true_crime (2 new) ──
  ('true crime story',          'en', 'longform', 70, 'true_crime'),
  ('mystery explained',         'en', 'longform', 70, 'true_crime'),

  -- ── celebrity_drama (3 new) ──
  ('film explained',            'en', 'longform', 70, 'celebrity_drama'),
  ('anime explained',           'en', 'longform', 70, 'celebrity_drama'),
  ('comedy',                    'en', 'longform', 70, 'celebrity_drama'),

  -- ── luxury_lifestyle (14 new) ──
  ('interior design tips',      'en', 'longform', 70, 'luxury_lifestyle'),
  ('outfit ideas',              'en', 'longform', 70, 'luxury_lifestyle'),
  ('makeup tutorial',           'en', 'longform', 70, 'luxury_lifestyle'),
  ('hair care tips',            'en', 'longform', 70, 'luxury_lifestyle'),
  ('skincare routine',          'en', 'longform', 70, 'luxury_lifestyle'),
  ('DIY home',                  'en', 'longform', 70, 'luxury_lifestyle'),
  ('home organization',         'en', 'longform', 70, 'luxury_lifestyle'),
  ('thrift haul',               'en', 'longform', 70, 'luxury_lifestyle'),
  ('travel vlog',               'en', 'longform', 70, 'luxury_lifestyle'),
  ('food review',               'en', 'longform', 70, 'luxury_lifestyle'),
  ('street food tour',          'en', 'longform', 70, 'luxury_lifestyle'),
  ('restaurant review',         'en', 'longform', 70, 'luxury_lifestyle'),
  ('international food',        'en', 'longform', 70, 'luxury_lifestyle'),
  ('city tour',                 'en', 'longform', 70, 'luxury_lifestyle')
ON CONFLICT DO NOTHING;

-- Verify after applying:
--   SELECT category, COUNT(*) FROM seed_keywords WHERE is_active=true AND language='en' GROUP BY category ORDER BY 2 DESC;
--   → ai_tools 20, finance 30, education_howto 29, self_improvement 17, luxury_lifestyle 14, fitness_health 10, true_crime 8, gaming_streamers 5, celebrity_drama 3, crypto 1
