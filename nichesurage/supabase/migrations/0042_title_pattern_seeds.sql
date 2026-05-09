-- 0042_title_pattern_seeds.sql
--
-- Sprint A.10 follow-up — add title-pattern phrased seeds alongside the
-- generic topic-word seeds from 0039. Generic seeds like "weight loss
-- tips" pull in too many low-quality search hits because they match
-- channel descriptions and tag spam. Title-pattern seeds match how
-- viral creators actually phrase their hooks ("I lost 30 pounds",
-- "why you can't lose weight"), which is far more selective.
--
-- Originals are NOT deleted — this is additive. Rotation + the existing
-- existingIds dedup in discover/index.ts handles the case where both
-- generic and title-pattern variants surface the same channel.
--
-- Priority 75 — slightly below the broad 0039 seeds (70) and the
-- themed seeds (75-90), so they rotate with the broad pool but don't
-- starve themed picks.

INSERT INTO seed_keywords (term, language, content_type, priority, category) VALUES
  -- ── ai_tools longform title patterns ────────────────────────────────
  ('this AI just changed everything',               'en', 'longform', 75, 'ai_tools'),
  ('the truth about ChatGPT',                       'en', 'longform', 75, 'ai_tools'),
  ('I built this with AI',                          'en', 'longform', 75, 'ai_tools'),
  ('AI tool that will replace',                     'en', 'longform', 75, 'ai_tools'),

  -- ── finance longform title patterns ─────────────────────────────────
  ('how I made my first',                           'en', 'longform', 75, 'finance'),
  ('the financial mistake that cost me',            'en', 'longform', 75, 'finance'),
  ('why you''re still broke',                       'en', 'longform', 75, 'finance'),
  ('how millionaires actually make money',          'en', 'longform', 75, 'finance'),
  ('I quit my job and now',                         'en', 'longform', 75, 'finance'),

  -- ── crypto longform title patterns ──────────────────────────────────
  ('this altcoin is about to',                      'en', 'longform', 75, 'crypto'),
  ('bitcoin just did something',                    'en', 'longform', 75, 'crypto'),
  ('crypto crashed and here''s why',                'en', 'longform', 75, 'crypto'),

  -- ── fitness_health longform title patterns ──────────────────────────
  ('I lost 30 pounds in',                           'en', 'longform', 75, 'fitness_health'),
  ('the diet that actually works',                  'en', 'longform', 75, 'fitness_health'),
  ('why you can''t lose weight',                    'en', 'longform', 75, 'fitness_health'),
  ('I tried this workout routine',                  'en', 'longform', 75, 'fitness_health'),

  -- ── self_improvement longform title patterns ────────────────────────
  ('the habit that changed my life',                'en', 'longform', 75, 'self_improvement'),
  ('I did this for 30 days',                        'en', 'longform', 75, 'self_improvement'),
  ('why you''re always tired',                      'en', 'longform', 75, 'self_improvement'),
  ('the mindset shift you need',                    'en', 'longform', 75, 'self_improvement'),

  -- ── luxury_lifestyle longform title patterns ────────────────────────
  ('a day in the life of',                          'en', 'longform', 75, 'luxury_lifestyle'),
  ('I lived like a millionaire for',                'en', 'longform', 75, 'luxury_lifestyle'),
  ('inside the life of',                            'en', 'longform', 75, 'luxury_lifestyle'),

  -- ── education_howto longform title patterns ─────────────────────────
  ('how to actually learn',                         'en', 'longform', 75, 'education_howto'),
  ('the easiest way to',                            'en', 'longform', 75, 'education_howto'),
  ('I taught myself this in',                       'en', 'longform', 75, 'education_howto')

ON CONFLICT DO NOTHING;
