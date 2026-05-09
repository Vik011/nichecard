-- 0041_shorts_seeds_underserved_categories.sql
--
-- Sprint A.10 follow-up — add Shorts coverage to categories that today
-- have zero (fitness_health, luxury_lifestyle) or thin (finance) Shorts
-- seed presence. Per the 2026-05-09 diagnostic: /discover Health and
-- Lifestyle chips infinite-loaded because the Shorts side of those
-- buckets had no seeds at all, and finance Shorts coverage was a single
-- crypto term.
--
-- Phrasing follows title-pattern style ("a day in my life", "I tried X
-- for") rather than generic topic words ("fitness", "lifestyle"). This
-- matches how viral Shorts actually phrase their hooks and yields better
-- precision in YouTube `search.list?q=` against shorts videos.
--
-- Priority 85 — between gaming Shorts (95, top of rotation per 0036) and
-- the longform broad seeds from 0039 (70). High enough that the new
-- buckets surface within the first few discover runs.

INSERT INTO seed_keywords (term, language, content_type, priority, category) VALUES
  -- ── fitness_health (12 new shorts) ──────────────────────────────────
  ('day 1 of getting in shape',                     'en', 'shorts', 85, 'fitness_health'),
  ('I tried this workout for',                      'en', 'shorts', 85, 'fitness_health'),
  ('this is why you can''t lose weight',            'en', 'shorts', 85, 'fitness_health'),
  ('what I eat in a day to lose weight',            'en', 'shorts', 85, 'fitness_health'),
  ('5 minute workout',                              'en', 'shorts', 85, 'fitness_health'),
  ('home workout no equipment',                     'en', 'shorts', 85, 'fitness_health'),
  ('healthy meal prep',                             'en', 'shorts', 85, 'fitness_health'),
  ('gym tips for beginners',                        'en', 'shorts', 85, 'fitness_health'),
  ('lose belly fat',                                'en', 'shorts', 85, 'fitness_health'),
  ('protein recipe',                                'en', 'shorts', 85, 'fitness_health'),
  ('stretch for posture',                           'en', 'shorts', 85, 'fitness_health'),
  ('beginner yoga',                                 'en', 'shorts', 85, 'fitness_health'),

  -- ── luxury_lifestyle (10 new shorts) ────────────────────────────────
  ('a day in my life',                              'en', 'shorts', 85, 'luxury_lifestyle'),
  ('morning routine that changed my life',          'en', 'shorts', 85, 'luxury_lifestyle'),
  ('luxury apartment tour',                         'en', 'shorts', 85, 'luxury_lifestyle'),
  ('what I bought this month',                      'en', 'shorts', 85, 'luxury_lifestyle'),
  ('outfit of the day',                             'en', 'shorts', 85, 'luxury_lifestyle'),
  ('skincare routine',                              'en', 'shorts', 85, 'luxury_lifestyle'),
  ('that girl morning',                             'en', 'shorts', 85, 'luxury_lifestyle'),
  ('aesthetic vlog',                                'en', 'shorts', 85, 'luxury_lifestyle'),
  ('clean girl aesthetic',                          'en', 'shorts', 85, 'luxury_lifestyle'),
  ('quiet luxury outfit',                           'en', 'shorts', 85, 'luxury_lifestyle'),

  -- ── self_improvement (5 new shorts, priority slightly lower 80) ─────
  ('things I wish I knew at 20',                    'en', 'shorts', 80, 'self_improvement'),
  ('this changed my mindset',                       'en', 'shorts', 80, 'self_improvement'),
  ('habits that changed my life',                   'en', 'shorts', 80, 'self_improvement'),
  ('how to focus better',                           'en', 'shorts', 80, 'self_improvement'),
  ('stop wasting your day',                         'en', 'shorts', 80, 'self_improvement'),

  -- ── finance (8 new shorts) ──────────────────────────────────────────
  ('how to make $100 a day',                        'en', 'shorts', 85, 'finance'),
  ('side hustle ideas',                             'en', 'shorts', 85, 'finance'),
  ('financial mistake young people make',           'en', 'shorts', 85, 'finance'),
  ('save money tips',                               'en', 'shorts', 85, 'finance'),
  ('passive income idea',                           'en', 'shorts', 85, 'finance'),
  ('how I budget',                                  'en', 'shorts', 85, 'finance'),
  ('credit card hack',                              'en', 'shorts', 85, 'finance'),
  ('millionaire habits',                            'en', 'shorts', 85, 'finance')

ON CONFLICT DO NOTHING;
