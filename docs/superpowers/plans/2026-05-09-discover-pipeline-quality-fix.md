# Discover Pipeline Quality Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the discover pipeline so every category chip in `/discover` populates with quality channels within 24h of deploy, niche labels are non-empty at insert, and full seed-sweep cycle drops from ~17 days to ~3 days.

**Architecture:** Three independent components: (B) new `trending` edge function pre-populating watchlist from YouTube `videos.list?chart=mostPopular`; (A) accelerate the existing `discover` edge function via `SEEDS_PER_RUN=25`, Shorts-flavored seeds, title-pattern seeds, and a one-shot full-sweep mode; (C+) shared niche-labeling helper called at insert (15–20 video titles via Anthropic Haiku) plus a one-shot Node script that backfills empty labels in existing rows.

**Tech Stack:** Deno (Supabase edge functions), TypeScript, Postgres + Supabase migrations, pg_cron, YouTube Data API v3, Anthropic Claude Haiku 4.5, Node 20 + `@supabase/supabase-js` (backfill script), Jest (Next.js app tests), Deno.test (edge function tests).

**Spec:** [docs/superpowers/specs/2026-05-09-discover-pipeline-quality-fix-design.md](../specs/2026-05-09-discover-pipeline-quality-fix-design.md)

---

## File Structure

**New files:**
- `nichesurage/supabase/migrations/0041_shorts_seeds_underserved_categories.sql` — Shorts seeds for Health, Lifestyle, Finance.
- `nichesurage/supabase/migrations/0042_title_pattern_seeds.sql` — Title-pattern phrasing seeds replacing generic topic words.
- `nichesurage/supabase/migrations/0043_trending_cron.sql` — pg_cron registration for the new `trending` edge function.
- `nichesurage/supabase/functions/_shared/labeling.ts` — `buildNicheLabel(channelName, recentTitles, fallback)` helper.
- `nichesurage/supabase/functions/_shared/labeling.test.ts` — unit tests for the helper.
- `nichesurage/supabase/functions/_shared/trendingCategoryMap.ts` — `videoCategoryId → CategoryBucketId` + `→ enumValue` map.
- `nichesurage/supabase/functions/_shared/trendingCategoryMap.test.ts` — unit tests for the map.
- `nichesurage/supabase/functions/trending/index.ts` — new edge function entry point.
- `nichesurage/scripts/backfillNicheLabels.ts` — Node one-shot to fill empty `niche_label` rows.

**Modified files:**
- `nichesurage/supabase/functions/_shared/youtube.ts` — add `getMostPopularVideos(...)` helper.
- `nichesurage/supabase/functions/_shared/youtube.test.ts` — add tests for the new helper.
- `nichesurage/supabase/functions/discover/index.ts` — call `buildNicheLabel(...)` at insert; add `?mode=full-sweep` operator path.

**Operator-only changes (no file):**
- Supabase env var `SEEDS_PER_RUN`: `4` → `25`.

---

## Task 0: Setup branch on top of master

**Files:**
- (no file changes)

**Why this comes first:** The active worktree branch is many migrations behind `origin/master` (only has migrations 0001–0004 locally). All the existing Sonar discover, category buckets, and seed_keywords schema lives on master. Implementing against the worktree state would re-invent code that already exists.

- [ ] **Step 1: Fetch latest master**

```bash
git fetch origin master
```

Expected: fetches without conflicts.

- [ ] **Step 2: Create implementation branch from master**

```bash
git checkout -b feat/discover-pipeline-quality-fix origin/master
```

Expected: `Switched to a new branch 'feat/discover-pipeline-quality-fix'`.

- [ ] **Step 3: Confirm migrations 0001–0040 are present**

```bash
ls nichesurage/supabase/migrations/ | tail -5
```

Expected: shows `0036_shorts_seed_keywords.sql` … `0040_quality_floor_v2.sql`.

- [ ] **Step 4: Confirm app builds clean before any changes**

```bash
cd nichesurage && npm install && npm run lint && npm test -- --passWithNoTests
```

Expected: install succeeds, lint passes, jest exits 0. If any step fails, STOP and report — the baseline is broken before our changes.

- [ ] **Step 5: Commit nothing (this task is setup only)**

No commit. Move to Task 1.

---

## Task 1: Migration 0041 — Shorts seeds for underserved categories

**Files:**
- Create: `nichesurage/supabase/migrations/0041_shorts_seeds_underserved_categories.sql`

**Goal:** Seed the categories that today have zero or thin Shorts coverage (Health, Lifestyle, Finance) with title-pattern Shorts seeds. Pattern matches the existing Shorts file 0036 (header comment, `INSERT … ON CONFLICT DO NOTHING`).

- [ ] **Step 1: Create the migration file with full content**

Write `nichesurage/supabase/migrations/0041_shorts_seeds_underserved_categories.sql`:

```sql
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
```

- [ ] **Step 2: Validate SQL parses (syntax check via dry-run)**

```bash
cd nichesurage && npx supabase db lint --schema public 2>&1 || echo "skip if supabase CLI not installed locally; CI will catch this"
```

Expected: no SQL syntax errors. If `supabase` CLI isn't installed, this step is informational only — CI applies migrations on deploy.

- [ ] **Step 3: Commit**

```bash
git add nichesurage/supabase/migrations/0041_shorts_seeds_underserved_categories.sql
git commit -m "feat(discover): shorts seeds for fitness_health, luxury_lifestyle, finance

35 new shorts seeds with title-pattern phrasing. Closes the empty-category
gap on /discover Health and Lifestyle chips that surfaced 2026-05-09."
```

---

## Task 2: Migration 0042 — Title-pattern seeds (replace generic phrasings)

**Files:**
- Create: `nichesurage/supabase/migrations/0042_title_pattern_seeds.sql`

**Goal:** Add title-pattern siblings to the most generic of the 137 existing seeds. Doesn't delete originals — `ON CONFLICT DO NOTHING` makes this idempotent and seed rotation handles dedup.

- [ ] **Step 1: Create the migration file with full content**

Write `nichesurage/supabase/migrations/0042_title_pattern_seeds.sql`:

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add nichesurage/supabase/migrations/0042_title_pattern_seeds.sql
git commit -m "feat(discover): title-pattern seeds for top categories

26 additive title-pattern seeds (priority 75) alongside the generic
0039 seeds. Better precision against viral video titles than generic
topic words."
```

---

## Task 3: Niche labeling helper — `_shared/labeling.ts`

**Files:**
- Create: `nichesurage/supabase/functions/_shared/labeling.ts`
- Create: `nichesurage/supabase/functions/_shared/labeling.test.ts`

**Goal:** A single helper both `discover` and `trending` use to compute a niche label at insert. Internally calls Anthropic Haiku with 15–20 video titles. Returns a fallback string on any failure (never throws to caller).

- [ ] **Step 1: Write the failing tests first**

Write `nichesurage/supabase/functions/_shared/labeling.test.ts`:

```ts
// supabase/functions/_shared/labeling.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { buildNicheLabel } from './labeling.ts'

type FetchInput = Parameters<typeof fetch>[0]

function withMockedFetch(
  resolveBody: (url: string) => unknown | Error,
  fn: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    const original = globalThis.fetch
    globalThis.fetch = ((input: FetchInput): Promise<Response> => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url
      const result = resolveBody(url)
      if (result instanceof Error) return Promise.reject(result)
      return Promise.resolve(
        new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }) as typeof fetch
    try {
      await fn()
    } finally {
      globalThis.fetch = original
    }
  }
}

Deno.test('buildNicheLabel: returns label from Anthropic response',
  withMockedFetch(
    () => ({ content: [{ text: 'AI prompt engineering' }] }),
    async () => {
      const label = await buildNicheLabel({
        apiKey: 'test',
        channelName: 'PromptCraft',
        recentTitles: ['How to write great prompts', 'GPT-4 prompt tips'],
        fallback: 'fallback-label',
      })
      assertEquals(label, 'ai prompt engineering')
    },
  ),
)

Deno.test('buildNicheLabel: trims whitespace from response',
  withMockedFetch(
    () => ({ content: [{ text: '  Body Recomp For Women   \n' }] }),
    async () => {
      const label = await buildNicheLabel({
        apiKey: 'test',
        channelName: 'FitJourney',
        recentTitles: ['Day 30 of body recomp'],
        fallback: 'fallback',
      })
      assertEquals(label, 'body recomp for women')
    },
  ),
)

Deno.test('buildNicheLabel: caps label at 40 chars',
  withMockedFetch(
    () => ({ content: [{ text: 'this is a very long label that exceeds forty characters easily' }] }),
    async () => {
      const label = await buildNicheLabel({
        apiKey: 'test',
        channelName: 'X',
        recentTitles: ['Y'],
        fallback: 'fallback',
      })
      assertEquals(label.length <= 40, true)
    },
  ),
)

Deno.test('buildNicheLabel: returns fallback on Anthropic 500',
  async () => {
    const original = globalThis.fetch
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response('upstream error', { status: 500 }),
      )) as typeof fetch
    try {
      const label = await buildNicheLabel({
        apiKey: 'test',
        channelName: 'X',
        recentTitles: ['Y'],
        fallback: 'side-hustle',
      })
      assertEquals(label, 'side-hustle')
    } finally {
      globalThis.fetch = original
    }
  },
)

Deno.test('buildNicheLabel: returns fallback on network error',
  withMockedFetch(
    () => new Error('network'),
    async () => {
      const label = await buildNicheLabel({
        apiKey: 'test',
        channelName: 'X',
        recentTitles: ['Y'],
        fallback: 'side-hustle',
      })
      assertEquals(label, 'side-hustle')
    },
  ),
)

Deno.test('buildNicheLabel: returns fallback on empty content',
  withMockedFetch(
    () => ({ content: [] }),
    async () => {
      const label = await buildNicheLabel({
        apiKey: 'test',
        channelName: 'X',
        recentTitles: ['Y'],
        fallback: 'fallback',
      })
      assertEquals(label, 'fallback')
    },
  ),
)

Deno.test('buildNicheLabel: returns fallback when no titles given',
  async () => {
    const label = await buildNicheLabel({
      apiKey: 'test',
      channelName: 'X',
      recentTitles: [],
      fallback: 'no-titles',
    })
    assertEquals(label, 'no-titles')
  },
)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd nichesurage/supabase/functions/_shared && deno test labeling.test.ts --allow-net
```

Expected: FAIL — `Cannot find module './labeling.ts'` or similar.

- [ ] **Step 3: Implement the helper**

Write `nichesurage/supabase/functions/_shared/labeling.ts`:

```ts
// supabase/functions/_shared/labeling.ts
//
// Niche labeling at watchlist insert. Used by discover and trending
// edge functions. Calls Anthropic Haiku with 15-20 video titles for
// the channel and asks for a 2-4 word niche label.
//
// Failure semantics: NEVER throws to caller. On any error (HTTP non-2xx,
// network, malformed response, empty titles list) returns the fallback
// string. Better to insert with a seed-keyword or empty fallback than to
// fail the whole insert flow.

const MAX_LABEL_CHARS = 40
const ANTHROPIC_TIMEOUT_MS = 5_000

export interface BuildNicheLabelArgs {
  apiKey: string
  channelName: string
  recentTitles: string[]
  /** Returned verbatim if labeling fails for any reason. */
  fallback: string
}

export async function buildNicheLabel(args: BuildNicheLabelArgs): Promise<string> {
  if (args.recentTitles.length === 0) return args.fallback

  const titlesText = args.recentTitles
    .slice(0, 20)
    .map(t => `- ${t}`)
    .join('\n')

  const prompt = `Given this YouTube channel name and its recent video titles, return a short niche label (2-4 words). Specific, not generic.

Examples of good labels:
- ai prompt engineering
- frugal couple finance
- body recomp for women
- minimalist survival cooking
- faceless stoic productivity

Examples of bad labels (too generic):
- tech, fitness, lifestyle, education

Channel: ${args.channelName}
Recent video titles:
${titlesText}

Respond with ONLY the niche label, lowercase, no quotes, no preamble.`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': args.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 30,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      console.warn(`buildNicheLabel: Anthropic ${res.status}, using fallback "${args.fallback}"`)
      return args.fallback
    }

    const data = await res.json()
    const text = data?.content?.[0]?.text
    if (typeof text !== 'string' || text.trim().length === 0) {
      return args.fallback
    }

    return text.trim().toLowerCase().slice(0, MAX_LABEL_CHARS)
  } catch (err) {
    console.warn(`buildNicheLabel: error, using fallback "${args.fallback}":`, err)
    return args.fallback
  } finally {
    clearTimeout(timeout)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd nichesurage/supabase/functions/_shared && deno test labeling.test.ts --allow-net
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add nichesurage/supabase/functions/_shared/labeling.ts nichesurage/supabase/functions/_shared/labeling.test.ts
git commit -m "feat(discover): shared niche labeling helper for insert path

buildNicheLabel(): Anthropic Haiku call, 5s timeout, never throws.
Returns fallback string on failure. Used by discover + trending."
```

---

## Task 4: Wire labeling into discover function

**Files:**
- Modify: `nichesurage/supabase/functions/discover/index.ts`

**Goal:** Replace `niche_label: ''` at insert with a `buildNicheLabel(...)` call. We pull 20 recent titles via the existing `getRecentVideos(...)` helper and use the seed term as fallback.

- [ ] **Step 1: Read the current insert block in discover/index.ts**

```bash
grep -n "niche_label" nichesurage/supabase/functions/discover/index.ts
```

Expected: shows the line with `niche_label: '',` in the insert object (around line ~225).

- [ ] **Step 2: Extend imports + add env-var read**

Open `nichesurage/supabase/functions/discover/index.ts`. Find the existing `_shared/youtube.ts` import block:

```ts
import {
  searchVideosByKeyword,
  getChannelStats,
  getVideoStatsBatch,
  getYoutubeKeys,
} from '../_shared/youtube.ts'
```

Replace with:

```ts
import {
  searchVideosByKeyword,
  getChannelStats,
  getVideoStatsBatch,
  getRecentVideos,
  getYoutubeKeys,
} from '../_shared/youtube.ts'
import { buildNicheLabel } from '../_shared/labeling.ts'
```

Inside the `Deno.serve` handler, near the other env reads (around `const youtubeKeys = getYoutubeKeys()`), add:

```ts
const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set')
```

- [ ] **Step 3: Replace the channels_watchlist insert to compute label first**

Find the block (currently at ~line 220):

```ts
const { error } = await supabase.from('channels_watchlist').insert({
  youtube_channel_id: channel.channelId,
  channel_name: channel.channelName,
  niche_label: '',                       // filled by clustering pipeline later
  content_type: exp.contentType,
  language: 'en',
  seed_keyword: seed.term,
  category: seed.category ?? null,
})
```

Replace with:

```ts
// Compute niche label at insert time instead of leaving '' for the
// deferred clustering pipeline. Pulls up to 20 recent titles.
// Fallback is seed.term — better than '' if Anthropic call fails.
let recentTitles: string[] = []
try {
  const videos = await getRecentVideos(youtubeKeys, channel.uploadsPlaylistId, 20)
  recentTitles = videos.map(v => v.title).filter(Boolean)
} catch (err) {
  console.warn(`recent-titles fetch failed for ${channel.channelId}:`, err)
}

const nicheLabel = await buildNicheLabel({
  apiKey: anthropicKey,
  channelName: channel.channelName,
  recentTitles,
  fallback: seed.term,
})

const { error } = await supabase.from('channels_watchlist').insert({
  youtube_channel_id: channel.channelId,
  channel_name: channel.channelName,
  niche_label: nicheLabel,
  content_type: exp.contentType,
  language: 'en',
  seed_keyword: seed.term,
  category: seed.category ?? null,
})
```

- [ ] **Step 4: Verify the file still parses with deno check**

```bash
cd nichesurage/supabase/functions/discover && deno check index.ts
```

Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add nichesurage/supabase/functions/discover/index.ts
git commit -m "feat(discover): build niche label at insert via Anthropic

Calls buildNicheLabel() with up to 20 recent titles per channel.
Falls back to seed.term on labeling failure. Replaces the empty
niche_label that was deferred to clustering."
```

---

## Task 5: Add `getMostPopularVideos` helper to `_shared/youtube.ts`

**Files:**
- Modify: `nichesurage/supabase/functions/_shared/youtube.ts`
- Modify: `nichesurage/supabase/functions/_shared/youtube.test.ts`

**Goal:** Wrap `videos.list?chart=mostPopular` with the existing key-rotation pattern. Returns video items with the contentDetails.duration parsed via existing `parseIsoDuration`.

- [ ] **Step 1: Define the result shape and write the failing test**

Open `nichesurage/supabase/functions/_shared/youtube.test.ts`. Append at the bottom:

```ts
// ─── getMostPopularVideos: mocked fetch ─────────────────────────────
import { getMostPopularVideos } from './youtube.ts'

Deno.test('getMostPopularVideos: returns parsed videos with duration in seconds',
  withMockedFetch(
    [
      {
        matchUrl: '/videos',
        body: {
          items: [
            {
              id: 'vid1',
              snippet: { title: 'Trending Tech', channelId: 'ch1', channelTitle: 'TechChan' },
              statistics: { viewCount: '1000000' },
              contentDetails: { duration: 'PT4M30S' },
            },
            {
              id: 'vid2',
              snippet: { title: 'Trending Short', channelId: 'ch2', channelTitle: 'ShortChan' },
              statistics: { viewCount: '500000' },
              contentDetails: { duration: 'PT45S' },
            },
          ],
        },
      },
    ],
    async () => {
      const videos = await getMostPopularVideos(['fake-key'], {
        videoCategoryId: '28',
        regionCode: 'US',
        maxResults: 50,
      })
      assertEquals(videos.length, 2)
      assertEquals(videos[0].videoId, 'vid1')
      assertEquals(videos[0].channelId, 'ch1')
      assertEquals(videos[0].durationSeconds, 270)
      assertEquals(videos[0].viewCount, 1_000_000)
      assertEquals(videos[1].durationSeconds, 45)
    },
  ),
)

Deno.test('getMostPopularVideos: empty items array returns []',
  withMockedFetch(
    [{ matchUrl: '/videos', body: { items: [] } }],
    async () => {
      const videos = await getMostPopularVideos(['fake-key'], {
        videoCategoryId: '99',
        regionCode: 'US',
        maxResults: 50,
      })
      assertEquals(videos.length, 0)
    },
  ),
)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd nichesurage/supabase/functions/_shared && deno test youtube.test.ts --allow-net
```

Expected: FAIL — `getMostPopularVideos` not exported.

- [ ] **Step 3: Implement the helper in `_shared/youtube.ts`**

Open `nichesurage/supabase/functions/_shared/youtube.ts`. At the end of the file (after `getRecentVideosWithStats`), add:

```ts
export interface TrendingVideo {
  videoId: string
  channelId: string
  channelName: string
  title: string
  viewCount: number
  durationSeconds: number
}

/**
 * Wrap `videos.list?chart=mostPopular` for a single (categoryId, regionCode)
 * pair. YouTube does NOT accept `videoDuration` on the chart endpoint, so
 * the caller post-filters by `durationSeconds`.
 *
 * Cost: 1 unit per call. We get 50 videos in one shot, no pagination needed.
 */
export async function getMostPopularVideos(
  apiKeys: string[],
  params: {
    videoCategoryId: string
    regionCode: 'US' | 'DE' | 'UK'
    maxResults?: number
  },
): Promise<TrendingVideo[]> {
  const buildUrl = (key: string) => {
    const url = new URL(`${BASE}/videos`)
    url.searchParams.set('key', key)
    url.searchParams.set('part', 'snippet,statistics,contentDetails')
    url.searchParams.set('chart', 'mostPopular')
    url.searchParams.set('videoCategoryId', params.videoCategoryId)
    url.searchParams.set('regionCode', params.regionCode)
    url.searchParams.set('maxResults', String(params.maxResults ?? 50))
    return url
  }

  const res = await tryFetchWithFallback(apiKeys, buildUrl, 'videos.list?chart=mostPopular')
  const data = await res.json()

  return (data.items ?? []).map((item: {
    id: string
    snippet: { title: string; channelId: string; channelTitle: string }
    statistics: { viewCount?: string }
    contentDetails: { duration?: string }
  }) => ({
    videoId: item.id,
    channelId: item.snippet.channelId,
    channelName: item.snippet.channelTitle,
    title: item.snippet.title,
    viewCount: parseInt(item.statistics.viewCount ?? '0', 10),
    durationSeconds: parseIsoDuration(item.contentDetails.duration),
  }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd nichesurage/supabase/functions/_shared && deno test youtube.test.ts --allow-net
```

Expected: all tests PASS (existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add nichesurage/supabase/functions/_shared/youtube.ts nichesurage/supabase/functions/_shared/youtube.test.ts
git commit -m "feat(youtube): getMostPopularVideos helper

Wraps videos.list?chart=mostPopular with key rotation. Returns
TrendingVideo[] with parsed duration in seconds. Used by trending
edge function."
```

---

## Task 6: Trending category map — `_shared/trendingCategoryMap.ts`

**Files:**
- Create: `nichesurage/supabase/functions/_shared/trendingCategoryMap.ts`
- Create: `nichesurage/supabase/functions/_shared/trendingCategoryMap.test.ts`

**Goal:** Map YouTube `videoCategoryId` → `(bucketId, categoryEnumValue)`. The category enum is what gets written to the `category` column of `channels_watchlist`. The bucket id is informational (used for logging).

- [ ] **Step 1: Write the failing tests**

Write `nichesurage/supabase/functions/_shared/trendingCategoryMap.test.ts`:

```ts
// supabase/functions/_shared/trendingCategoryMap.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  TRENDING_CATEGORY_MAP,
  resolveCategoryEnum,
  TRENDING_REGIONS,
} from './trendingCategoryMap.ts'

Deno.test('TRENDING_CATEGORY_MAP: covers expected YouTube category IDs', () => {
  const ids = Object.keys(TRENDING_CATEGORY_MAP).sort()
  assertEquals(ids, ['17', '20', '22', '24', '25', '26', '27', '28'])
})

Deno.test('TRENDING_CATEGORY_MAP: every entry has bucketId + categoryEnum', () => {
  for (const [_, entry] of Object.entries(TRENDING_CATEGORY_MAP)) {
    assertEquals(typeof entry.bucketId, 'string')
    assertEquals(typeof entry.categoryEnum, 'string')
  }
})

Deno.test('resolveCategoryEnum: 28 (Science & Tech) → ai_tools', () => {
  assertEquals(resolveCategoryEnum('28'), 'ai_tools')
})

Deno.test('resolveCategoryEnum: 20 (Gaming) → gaming_streamers', () => {
  assertEquals(resolveCategoryEnum('20'), 'gaming_streamers')
})

Deno.test('resolveCategoryEnum: 17 (Sports) → fitness_health', () => {
  assertEquals(resolveCategoryEnum('17'), 'fitness_health')
})

Deno.test('resolveCategoryEnum: unknown id → null', () => {
  assertEquals(resolveCategoryEnum('999'), null)
})

Deno.test('TRENDING_REGIONS: includes US, DE, UK', () => {
  assertEquals(TRENDING_REGIONS, ['US', 'DE', 'UK'])
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd nichesurage/supabase/functions/_shared && deno test trendingCategoryMap.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the map**

Write `nichesurage/supabase/functions/_shared/trendingCategoryMap.ts`:

```ts
// supabase/functions/_shared/trendingCategoryMap.ts
//
// Maps YouTube videoCategoryId (used by videos.list?chart=mostPopular) to
// the app's category_enum + 7-bucket UI grouping. Each map entry picks a
// SINGLE category_enum value per YouTube category — sub-categorization
// within a bucket (ai_tools vs tech_reviews) is left to the labeling step.
//
// 8 entries cover the YouTube categories we care about. Music (10),
// Comedy (23), Film (1), Pets (15), Travel (19), Cars (2) are intentionally
// skipped — none map cleanly to a SurgeNiche bucket and would dilute results.
//
// Finance has no native YouTube category; coverage relies on the seed-driven
// discover function (Component A in the spec).

export type TrendingBucketId =
  | 'tech-ai'
  | 'finance'
  | 'health'
  | 'lifestyle'
  | 'education'
  | 'gaming'
  | 'entertainment'

export interface TrendingCategoryEntry {
  /** YouTube label for documentation purposes. */
  ytLabel: string
  /** App-side 7-bucket UI grouping. */
  bucketId: TrendingBucketId
  /** Single category_enum value to write to channels_watchlist.category. */
  categoryEnum: string
}

/**
 * The mapping is keyed by YouTube videoCategoryId (string, as used in the
 * URL parameter).
 */
export const TRENDING_CATEGORY_MAP: Record<string, TrendingCategoryEntry> = {
  '28': { ytLabel: 'Science & Technology', bucketId: 'tech-ai',       categoryEnum: 'ai_tools' },
  '27': { ytLabel: 'Education',            bucketId: 'education',     categoryEnum: 'education_howto' },
  '26': { ytLabel: 'Howto & Style',        bucketId: 'lifestyle',     categoryEnum: 'self_improvement' },
  '22': { ytLabel: 'People & Blogs',       bucketId: 'lifestyle',     categoryEnum: 'luxury_lifestyle' },
  '17': { ytLabel: 'Sports',               bucketId: 'health',        categoryEnum: 'fitness_health' },
  '24': { ytLabel: 'Entertainment',        bucketId: 'entertainment', categoryEnum: 'celebrity_drama' },
  '25': { ytLabel: 'News & Politics',      bucketId: 'entertainment', categoryEnum: 'geopolitics_news' },
  '20': { ytLabel: 'Gaming',               bucketId: 'gaming',        categoryEnum: 'gaming_streamers' },
}

export function resolveCategoryEnum(categoryId: string): string | null {
  return TRENDING_CATEGORY_MAP[categoryId]?.categoryEnum ?? null
}

/** Regions covered by the trending function. US + DE matches Sonar; UK adds
 * a third English trending culture (often diverges from US for Lifestyle/Entertainment). */
export const TRENDING_REGIONS: ReadonlyArray<'US' | 'DE' | 'UK'> = ['US', 'DE', 'UK']
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd nichesurage/supabase/functions/_shared && deno test trendingCategoryMap.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add nichesurage/supabase/functions/_shared/trendingCategoryMap.ts nichesurage/supabase/functions/_shared/trendingCategoryMap.test.ts
git commit -m "feat(trending): YouTube category → app bucket map

8 YouTube categories mapped to 7 app buckets. resolveCategoryEnum()
returns the single category_enum to write to channels_watchlist.
TRENDING_REGIONS = US, DE, UK."
```

---

## Task 7: Trending edge function — `functions/trending/index.ts`

**Files:**
- Create: `nichesurage/supabase/functions/trending/index.ts`

**Goal:** Single Deno.serve handler. For each (categoryId, regionCode), pulls 50 trending videos, post-filters by duration, hydrates unique channels, applies discover-equivalent gates, computes niche label, inserts. Returns JSON summary.

- [ ] **Step 1: Create the function file**

Write `nichesurage/supabase/functions/trending/index.ts`:

```ts
// supabase/functions/trending/index.ts
//
// Trending discover: bypasses the seed-keyword cold start by pulling
// channels behind YouTube's mostPopular chart per category × region.
//
// Per-run flow:
//   1. For each (categoryId, regionCode) in TRENDING_CATEGORY_MAP × TRENDING_REGIONS:
//      a. videos.list?chart=mostPopular&maxResults=50 (1 unit per call)
//      b. Bucket each video: durationSeconds < 60 → shorts, else → longform
//      c. Dedup by (channelId, content_type) and skip already-watchlisted pairs
//   2. Hydrate unique channels via getChannelStats (1 unit / 50 batch)
//   3. Apply discover-equivalent gates (subs, age, video count)
//   4. Compute niche label via buildNicheLabel (15-20 recent titles)
//   5. Insert with seed_keyword='__trending_<categoryId>' for traceability

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getYoutubeKeys,
  getMostPopularVideos,
  getChannelStats,
  getRecentVideos,
  type TrendingVideo,
} from '../_shared/youtube.ts'
import {
  TRENDING_CATEGORY_MAP,
  TRENDING_REGIONS,
  resolveCategoryEnum,
} from '../_shared/trendingCategoryMap.ts'
import { buildNicheLabel } from '../_shared/labeling.ts'

// Match the gates already used by discover (verified against discover/index.ts
// constants on 2026-05-09). Keep these in sync if discover gates change.
const MIN_SUBS_SHORTS = 5_000
const MIN_SUBS_LONGFORM = 2_000
const MAX_SUBS_SHORTS = 400_000
const MAX_SUBS_LONGFORM = 400_000
const MAX_AGE_MONTHS_SHORTS = 12
const MAX_AGE_MONTHS_LONGFORM = 24
const MAX_VIDEO_COUNT_LONGFORM = 200
const MAX_VIDEO_COUNT_SHORTS = 500

const SHORTS_DURATION_SECONDS = 60

interface ChannelKey {
  channelId: string
  contentType: 'shorts' | 'longform'
}

function keyOf(k: ChannelKey): string {
  return `${k.channelId}::${k.contentType}`
}

Deno.serve(async (_req: Request) => {
  try {
    const youtubeKeys = getYoutubeKeys()
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set')
    if (!supabaseUrl) throw new Error('SUPABASE_URL not set')
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Existing watchlist set is keyed by (channelId, content_type) — a single
    // channel can appear once per format.
    const { data: existing } = await supabase
      .from('channels_watchlist')
      .select('youtube_channel_id, content_type')
    const existingKeys = new Set<string>(
      (existing ?? []).map((c: { youtube_channel_id: string; content_type: string }) =>
        `${c.youtube_channel_id}::${c.content_type}`,
      ),
    )

    let totalAdded = 0
    const summary: Array<{ category: string; region: string; added: number; reason?: string }> = []

    for (const categoryId of Object.keys(TRENDING_CATEGORY_MAP)) {
      const entry = TRENDING_CATEGORY_MAP[categoryId]
      const categoryEnum = resolveCategoryEnum(categoryId)!  // map guarantees non-null

      for (const regionCode of TRENDING_REGIONS) {
        try {
          const videos = await getMostPopularVideos(youtubeKeys, {
            videoCategoryId: categoryId,
            regionCode,
            maxResults: 50,
          })
          if (videos.length === 0) {
            summary.push({ category: entry.ytLabel, region: regionCode, added: 0, reason: 'no trending videos' })
            continue
          }

          // Bucket each video by duration → derive (channelId, contentType) pairs.
          const candidatePairs = new Map<string, ChannelKey>()
          for (const v of videos) {
            const contentType: 'shorts' | 'longform' =
              v.durationSeconds > 0 && v.durationSeconds < SHORTS_DURATION_SECONDS ? 'shorts' : 'longform'
            const key: ChannelKey = { channelId: v.channelId, contentType }
            const composite = keyOf(key)
            if (existingKeys.has(composite)) continue
            if (candidatePairs.has(composite)) continue
            candidatePairs.set(composite, key)
          }
          if (candidatePairs.size === 0) {
            summary.push({ category: entry.ytLabel, region: regionCode, added: 0, reason: 'all already in watchlist' })
            continue
          }

          // Hydrate channels (one batch per 50).
          const channelIdsForHydration = [...new Set([...candidatePairs.values()].map(p => p.channelId))]
          const stats = await getChannelStats(youtubeKeys, channelIdsForHydration)
          const statsById = new Map(stats.map(s => [s.channelId, s]))

          let addedThisRun = 0
          for (const pair of candidatePairs.values()) {
            const ch = statsById.get(pair.channelId)
            if (!ch) continue

            // Gates — match discover.
            const minSubs = pair.contentType === 'shorts' ? MIN_SUBS_SHORTS : MIN_SUBS_LONGFORM
            const maxSubs = pair.contentType === 'shorts' ? MAX_SUBS_SHORTS : MAX_SUBS_LONGFORM
            const maxAgeMonths = pair.contentType === 'shorts' ? MAX_AGE_MONTHS_SHORTS : MAX_AGE_MONTHS_LONGFORM
            const maxVideoCount = pair.contentType === 'shorts' ? MAX_VIDEO_COUNT_SHORTS : MAX_VIDEO_COUNT_LONGFORM

            if (ch.subscriberCount < minSubs) continue
            if (ch.subscriberCount > maxSubs) continue
            if (ch.videoCount > maxVideoCount) continue
            const ageMs = Date.now() - new Date(ch.channelCreatedAt).getTime()
            if (ageMs > maxAgeMonths * 30 * 24 * 60 * 60 * 1000) continue

            // Niche label.
            let recentTitles: string[] = []
            try {
              const recent = await getRecentVideos(youtubeKeys, ch.uploadsPlaylistId, 20)
              recentTitles = recent.map(v => v.title).filter(Boolean)
            } catch (err) {
              console.warn(`recent-titles fetch failed for ${ch.channelId}:`, err)
            }
            const nicheLabel = await buildNicheLabel({
              apiKey: anthropicKey,
              channelName: ch.channelName,
              recentTitles,
              fallback: '',
            })

            const { error } = await supabase.from('channels_watchlist').insert({
              youtube_channel_id: ch.channelId,
              channel_name: ch.channelName,
              niche_label: nicheLabel,
              content_type: pair.contentType,
              language: 'en',
              seed_keyword: `__trending_${categoryId}`,
              category: categoryEnum,
            })
            if (error) {
              if (error.code !== '23505') {
                console.error(`trending insert failed for ${ch.channelId}:`, error)
              }
            } else {
              addedThisRun++
              existingKeys.add(keyOf(pair))
            }
          }

          totalAdded += addedThisRun
          summary.push({ category: entry.ytLabel, region: regionCode, added: addedThisRun })
        } catch (err) {
          console.error(`trending ${categoryId}/${regionCode} failed:`, err)
          summary.push({ category: entry.ytLabel, region: regionCode, added: 0, reason: String(err).slice(0, 120) })
        }
      }
    }

    return new Response(JSON.stringify({ success: true, totalAdded, summary }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('trending fatal error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

- [ ] **Step 2: Type-check the file**

```bash
cd nichesurage/supabase/functions/trending && deno check index.ts
```

Expected: no type errors. (Deno may need network access on first run for esm.sh imports — re-run with `--allow-net` if it errors on those.)

- [ ] **Step 3: Smoke-deploy via Supabase CLI (if available locally)**

```bash
cd nichesurage && npx supabase functions deploy trending --project-ref <YOUR_REF> 2>&1 || echo "skip locally; CI will deploy"
```

Expected: succeeds, or "skip" message if CLI not configured locally.

- [ ] **Step 4: Commit**

```bash
git add nichesurage/supabase/functions/trending/index.ts
git commit -m "feat(trending): new edge function for chart=mostPopular

Pulls trending videos per (category, region), buckets by duration,
hydrates unique channels, applies discover-equivalent gates, labels,
and inserts with seed_keyword='__trending_<categoryId>'."
```

---

## Task 8: Migration 0043 — Register trending cron

**Files:**
- Create: `nichesurage/supabase/migrations/0043_trending_cron.sql`

**Goal:** Schedule the trending function to run 1×/day at 09:00 UTC (offset 6h from discover at 03:00 + 15:00). Same idempotency pattern as 0037.

- [ ] **Step 1: Create the migration file**

Write `nichesurage/supabase/migrations/0043_trending_cron.sql`:

```sql
-- 0043_trending_cron.sql
--
-- Sprint A.10 follow-up — register the new `trending` edge function on
-- pg_cron at 1×/day, 09:00 UTC. Offset 6h from the discover schedule
-- (03:00 + 15:00 UTC, see 0037) so quota usage is spread.
--
-- Cost estimate: ~60-80 YouTube API units per run × 1 run/day = 60-80
-- units/day. Negligible against the 20K/day budget.
--
-- IDEMPOTENCY: cron.unschedule first (wrapped in DO block), then
-- cron.schedule. Same pattern as 0037.

DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('daily-trending');
    RAISE NOTICE 'unscheduled daily-trending (pre-existing)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'daily-trending was not previously scheduled (skipping unschedule)';
  END;
END $$;

SELECT cron.schedule(
  'daily-trending',
  '0 9 * * *',
  $$ SELECT public.invoke_edge_function('trending'); $$
);

-- Verify after applying:
--   SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'daily-trending';
--   → schedule should read '0 9 * * *'
```

- [ ] **Step 2: Commit**

```bash
git add nichesurage/supabase/migrations/0043_trending_cron.sql
git commit -m "feat(trending): pg_cron 1×/day schedule at 09:00 UTC

Offset 6h from discover cron. Idempotent unschedule+schedule pattern
matches 0037."
```

---

## Task 9: Add `?mode=full-sweep` to discover function

**Files:**
- Modify: `nichesurage/supabase/functions/discover/index.ts`

**Goal:** Operator-only path that ignores `SEEDS_PER_RUN` and processes ALL active EN seeds in one run, in batches of 25 with a 5s sleep between batches. Authenticated by service role key.

- [ ] **Step 1: Add the mode-detection block at the top of the handler**

Open `nichesurage/supabase/functions/discover/index.ts`. Find:

```ts
Deno.serve(async (_req: Request) => {
  try {
    const youtubeKeys = getYoutubeKeys()
```

Replace with:

```ts
Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url)
    const mode = url.searchParams.get('mode')
    const isFullSweep = mode === 'full-sweep'

    // Operator-only: full-sweep requires explicit service role key in
    // Authorization header. Cron invocations don't need this — they call
    // without ?mode= and use the default rotation.
    if (isFullSweep) {
      const expected = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      if (req.headers.get('Authorization') !== expected) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    const youtubeKeys = getYoutubeKeys()
```

- [ ] **Step 2: Replace the seed query to honor full-sweep**

Find the seed query (around line ~110):

```ts
const { data: seedRows, error: seedErr } = await supabase
  .from('seed_keywords')
  .select('*')
  .eq('is_active', true)
  .eq('language', 'en')
  .order('last_used_at', { ascending: true, nullsFirst: true })
  .order('priority', { ascending: false })
  .limit(SEEDS_PER_RUN)
```

Replace with:

```ts
const seedQuery = supabase
  .from('seed_keywords')
  .select('*')
  .eq('is_active', true)
  .eq('language', 'en')
  .order('last_used_at', { ascending: true, nullsFirst: true })
  .order('priority', { ascending: false })

const { data: seedRows, error: seedErr } = isFullSweep
  ? await seedQuery
  : await seedQuery.limit(SEEDS_PER_RUN)
```

- [ ] **Step 3: Add inter-batch sleep when in full-sweep**

Find the existing `for (const seed of seedRows as SeedKeyword[]) {` loop. Just before the `for` loop, define:

```ts
const FULL_SWEEP_BATCH_SIZE = 25
const FULL_SWEEP_BATCH_DELAY_MS = 5_000
```

Inside the loop, at the very top of the seed body (right after `usedSeedIds.push(seed.id)`), add:

```ts
// Full-sweep politeness: sleep between batches so we don't hammer
// YouTube quota in a single burst.
if (isFullSweep && usedSeedIds.length > 1 && (usedSeedIds.length - 1) % FULL_SWEEP_BATCH_SIZE === 0) {
  console.log(`full-sweep: completed ${usedSeedIds.length - 1} seeds, sleeping ${FULL_SWEEP_BATCH_DELAY_MS}ms`)
  await new Promise(r => setTimeout(r, FULL_SWEEP_BATCH_DELAY_MS))
}
```

- [ ] **Step 4: Type-check**

```bash
cd nichesurage/supabase/functions/discover && deno check index.ts
```

Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add nichesurage/supabase/functions/discover/index.ts
git commit -m "feat(discover): add ?mode=full-sweep operator path

Service-role-authenticated mode that processes ALL active EN seeds
in one run, batches of 25 with 5s sleep. Used once after deploy to
fully populate the watchlist."
```

---

## Task 10: Backfill script — `scripts/backfillNicheLabels.ts`

**Files:**
- Create: `nichesurage/scripts/backfillNicheLabels.ts`

**Goal:** Node one-shot. Reads up to 500 watchlist rows where `niche_label IS NULL OR niche_label = ''`, fetches 20 recent titles for each via the YouTube API (re-using the same prompt as `buildNicheLabel`), updates the row. Has `--dry-run` flag.

- [ ] **Step 1: Verify scripts directory and check tsx availability**

```bash
ls nichesurage/scripts/ 2>&1 || mkdir -p nichesurage/scripts
```

Expected: directory exists or is created. We use `tsx` (already a transitive dep via Next.js dev tooling) to run TS scripts. If unavailable on the engineer's machine, `npx tsx ...` invocation handles it.

- [ ] **Step 2: Write the script**

Write `nichesurage/scripts/backfillNicheLabels.ts`:

```ts
// nichesurage/scripts/backfillNicheLabels.ts
//
// One-shot backfill: fill empty niche_label rows in channels_watchlist
// using the same Anthropic Haiku flow as the discover/trending insert path.
//
// Usage:
//   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  YOUTUBE_API_KEY=...
//   ANTHROPIC_API_KEY=...  npx tsx nichesurage/scripts/backfillNicheLabels.ts
//
//   Add --dry-run to print proposed updates without writing.
//
// Default batch: 500 rows. Limits configurable via BATCH_SIZE env var.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? '500', 10)
const DRY_RUN = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !YOUTUBE_API_KEY || !ANTHROPIC_API_KEY) {
  console.error('Missing env: need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY, ANTHROPIC_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const YT = 'https://www.googleapis.com/youtube/v3'

interface WatchlistRow {
  id: string
  youtube_channel_id: string
  channel_name: string
  niche_label: string | null
  seed_keyword: string | null
}

async function fetchUploadsPlaylistId(channelId: string): Promise<string | null> {
  const url = `${YT}/channels?key=${YOUTUBE_API_KEY}&id=${channelId}&part=contentDetails&maxResults=1`
  const res = await fetch(url)
  if (!res.ok) {
    console.warn(`channels.list ${res.status} for ${channelId}`)
    return null
  }
  const data = await res.json()
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null
}

async function fetchRecentTitles(uploadsPlaylistId: string): Promise<string[]> {
  const playlistUrl = `${YT}/playlistItems?key=${YOUTUBE_API_KEY}&playlistId=${uploadsPlaylistId}&part=contentDetails&maxResults=20`
  const playlistRes = await fetch(playlistUrl)
  if (!playlistRes.ok) return []
  const playlistData = await playlistRes.json()
  const videoIds: string[] = (playlistData.items ?? [])
    .map((it: { contentDetails?: { videoId?: string } }) => it.contentDetails?.videoId)
    .filter(Boolean)
  if (videoIds.length === 0) return []

  const videosUrl = `${YT}/videos?key=${YOUTUBE_API_KEY}&id=${videoIds.join(',')}&part=snippet&maxResults=${videoIds.length}`
  const videosRes = await fetch(videosUrl)
  if (!videosRes.ok) return []
  const videosData = await videosRes.json()
  return (videosData.items ?? [])
    .map((it: { snippet?: { title?: string } }) => it.snippet?.title)
    .filter((t: unknown): t is string => typeof t === 'string' && t.length > 0)
}

async function buildLabel(channelName: string, titles: string[], fallback: string): Promise<string> {
  if (titles.length === 0) return fallback
  const titlesText = titles.slice(0, 20).map(t => `- ${t}`).join('\n')
  const prompt = `Given this YouTube channel name and its recent video titles, return a short niche label (2-4 words). Specific, not generic.

Examples of good labels:
- ai prompt engineering
- frugal couple finance
- body recomp for women
- minimalist survival cooking
- faceless stoic productivity

Examples of bad labels (too generic):
- tech, fitness, lifestyle, education

Channel: ${channelName}
Recent video titles:
${titlesText}

Respond with ONLY the niche label, lowercase, no quotes, no preamble.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 30,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return fallback
    const data = await res.json()
    const text = data?.content?.[0]?.text
    if (typeof text !== 'string' || text.trim().length === 0) return fallback
    return text.trim().toLowerCase().slice(0, 40)
  } catch {
    return fallback
  }
}

async function main() {
  console.log(`backfillNicheLabels: dry-run=${DRY_RUN}, batch=${BATCH_SIZE}`)

  const { data: rows, error } = await supabase
    .from('channels_watchlist')
    .select('id, youtube_channel_id, channel_name, niche_label, seed_keyword')
    .or('niche_label.is.null,niche_label.eq.')
    .order('first_discovered_at', { ascending: false })
    .limit(BATCH_SIZE)
  if (error) throw error
  if (!rows || rows.length === 0) {
    console.log('No empty-label rows to backfill.')
    return
  }
  console.log(`Found ${rows.length} rows to backfill.`)

  let updated = 0
  let skipped = 0
  let failed = 0

  for (const row of rows as WatchlistRow[]) {
    try {
      const uploadsId = await fetchUploadsPlaylistId(row.youtube_channel_id)
      if (!uploadsId) {
        console.warn(`no uploads playlist for ${row.youtube_channel_id} (deleted channel?)`)
        skipped++
        continue
      }
      const titles = await fetchRecentTitles(uploadsId)
      const fallback = row.seed_keyword ?? ''
      const label = await buildLabel(row.channel_name, titles, fallback)

      if (label === '' || label === fallback && fallback === '') {
        console.warn(`no label produced for ${row.channel_name}`)
        skipped++
        continue
      }

      if (DRY_RUN) {
        console.log(`[dry-run] ${row.channel_name} → "${label}"`)
        updated++
        continue
      }

      const { error: upErr } = await supabase
        .from('channels_watchlist')
        .update({ niche_label: label })
        .eq('id', row.id)
      if (upErr) {
        console.error(`update failed for ${row.id}:`, upErr)
        failed++
      } else {
        console.log(`${row.channel_name} → "${label}"`)
        updated++
      }
    } catch (err) {
      console.error(`row ${row.id} failed:`, err)
      failed++
    }
  }

  console.log(`\nDone. updated=${updated} skipped=${skipped} failed=${failed}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 3: Verify the script type-checks via tsc**

```bash
cd nichesurage && npx tsc --noEmit scripts/backfillNicheLabels.ts 2>&1 | head -20
```

Expected: no type errors. If `Cannot find name 'process'` appears, ensure `@types/node` is in dev deps (it is, per package.json).

- [ ] **Step 4: Dry-run smoke (without service-role secret on dev machine, this just prints "Missing env" — that's fine)**

```bash
cd nichesurage && npx tsx scripts/backfillNicheLabels.ts --dry-run 2>&1 | head -3
```

Expected: prints "Missing env: …" and exits 1, OR runs successfully if envs are set. Either is acceptable; we're checking the script parses and starts.

- [ ] **Step 5: Commit**

```bash
git add nichesurage/scripts/backfillNicheLabels.ts
git commit -m "feat(discover): backfill script for empty niche_label rows

One-shot Node script. Reads up to 500 empty-label rows, fetches 20
recent titles per channel, calls Anthropic Haiku, updates row.
Supports --dry-run."
```

---

## Task 11: Open the PR

**Files:**
- (no file changes)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/discover-pipeline-quality-fix
```

Expected: branch pushed.

- [ ] **Step 2: Open PR against `master`**

```bash
gh pr create --title "feat(discover): pipeline quality fix — trending, labeling, accelerate" --body "$(cat <<'EOF'
## Summary
- New `trending` edge function: pulls YouTube `chart=mostPopular` per category × region (US/DE/UK) → channel hydration → label → insert.
- Niche labeling at insert via Anthropic Haiku (15–20 video titles), shared by `discover` and `trending`. Replaces deferred-clustering empty labels.
- 35 Shorts seeds (Health/Lifestyle/Finance), 26 title-pattern longform seeds, `?mode=full-sweep` operator path on discover.
- Backfill Node script for existing empty-label rows.
- pg_cron schedule for trending (daily 09:00 UTC).

Spec: `docs/superpowers/specs/2026-05-09-discover-pipeline-quality-fix-design.md`
Plan: `docs/superpowers/plans/2026-05-09-discover-pipeline-quality-fix.md`

## Test plan
- [ ] All Deno.test suites pass (`_shared/labeling.test.ts`, `_shared/trendingCategoryMap.test.ts`, `_shared/youtube.test.ts`).
- [ ] Migrations 0041 / 0042 / 0043 apply cleanly on a staging DB.
- [ ] Operator runs full-sweep + trending kickoff (Task 12) and observes inserts in `channels_watchlist`.
- [ ] Within 24h of cron resumption, `/discover` Health and Lifestyle chips populate with ≥10 channels each.
- [ ] Spot-check: pick 5 newly-inserted rows; their `niche_label` is specific (not blank, not "tech"/"fitness").

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.

- [ ] **Step 3: Wait for CI green; do NOT merge yet**

CI runs lint + Jest + Deno tests. After green, hand the PR off to a human reviewer before merging. Migrations should not apply to production until the PR is approved.

---

## Task 12: Post-merge operator playbook

**Files:**
- (no file changes — this is operator runbook, not code)

This task is the deploy + smoke + kickoff sequence. Run it after the PR merges and the deploy pipeline applies the migrations + deploys both edge functions.

- [ ] **Step 1: Confirm Supabase env var bump**

In the Supabase dashboard → Project → Settings → Edge Functions → Secrets:

```
SEEDS_PER_RUN = 25
```

(Was `4`. If unset, the function defaults to `4` per `parseInt(... ?? '4', 10)`.)

- [ ] **Step 2: Confirm migrations applied**

```bash
supabase db push --project-ref <YOUR_REF>     # if using CLI
# or check the migrations table directly:
psql -h <DB_HOST> -U postgres -d postgres -c "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;"
```

Expected: includes `0041`, `0042`, `0043`.

- [ ] **Step 3: Confirm cron jobs registered**

```sql
SELECT jobname, schedule, command FROM cron.job WHERE jobname IN ('daily-discover','daily-trending');
```

Expected: two rows. `daily-discover` schedule `0 3,15 * * *`; `daily-trending` schedule `0 9 * * *`.

- [ ] **Step 4: Trigger trending function once (kickoff)**

```bash
curl -X POST "https://<PROJECT>.supabase.co/functions/v1/trending" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json"
```

Expected: HTTP 200, JSON body with `success: true`, `totalAdded: <N>`, `summary[]` array of (category, region, added) entries. **N should be > 0**. If 0 across all entries, check function logs — most likely YouTube API key issue.

- [ ] **Step 5: Trigger discover full sweep**

```bash
curl -X POST "https://<PROJECT>.supabase.co/functions/v1/discover?mode=full-sweep" \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"
```

This is a long-running call (~5–10 minutes for 137 seeds with batch sleeps). Expect `success: true, added: <N>, seeds_used: <count>` where `seeds_used` ≈ 137.

- [ ] **Step 6: Run backfill script for empty labels**

From a machine with the Supabase service role key (or a CI runner):

```bash
cd nichesurage
SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  YOUTUBE_API_KEY=...  ANTHROPIC_API_KEY=... \
  npx tsx scripts/backfillNicheLabels.ts --dry-run
```

Inspect the dry-run output. If it looks reasonable (specific labels, not generic), re-run without `--dry-run`:

```bash
SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  YOUTUBE_API_KEY=...  ANTHROPIC_API_KEY=... \
  npx tsx scripts/backfillNicheLabels.ts
```

- [ ] **Step 7: Verify in /discover UI**

Navigate to `/discover` in the app. Within ~1h of step 5 finishing (scan cron runs every 1h on master per 0026), every category chip should show channels. Spot-check: open Health and Lifestyle — should no longer show infinite-load empty state.

- [ ] **Step 8: Reset SEEDS_PER_RUN if quota becomes a concern**

Monitor YouTube API quota usage in Google Cloud Console for 48h. If it climbs past comfort level, revert env var to `15` or back to `4` — full sweep is already done at this point, ongoing rotation just keeps the watchlist fresh.

---

## Self-Review Notes

The plan was written from scratch against the spec sections and verified file-by-file against `origin/master` content. Key checks:

- **Spec coverage:** Component A (acceleration) → Tasks 1, 2, 9. Component B (trending) → Tasks 5, 6, 7, 8. Component C+ (labeling) → Tasks 3, 4, 10. Operator playbook → Task 12. PR/branch hygiene → Tasks 0, 11. All spec sections accounted for.
- **No placeholders:** Every code/SQL block is complete and copy-pasteable. Migration SQL is fully written, not "add seeds here".
- **Type consistency:** `buildNicheLabel(args)` interface matches between Task 3 (definition), Task 4 (discover), Task 7 (trending). `getMostPopularVideos` return type `TrendingVideo` is defined in Task 5, consumed in Task 7 with the right field names. `TRENDING_CATEGORY_MAP` keys are strings throughout (matches the `videoCategoryId` URL param type).
- **Branch reality:** Task 0 explicitly branches from `origin/master`, not from the active worktree which is many migrations behind. This is critical — implementing against the worktree state would re-invent existing schema.
