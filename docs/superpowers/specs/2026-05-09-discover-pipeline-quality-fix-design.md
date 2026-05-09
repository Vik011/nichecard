# Discover Pipeline Quality Fix — Design

**Date:** 2026-05-09
**Status:** Approved (high-level)
**Owner:** SurgeNiche
**Worktree branch:** `claude/musing-ramanujan-214c98`

## Problem

After 5 days of running the discover + scan cron jobs, only ~40 channels are visible in `/discover`. Several category chips (notably **Health** and **Lifestyle**) show an empty state with infinite loading. Supabase reports many more channels in `channels_watchlist` than appear in the app — they're either filtered out by the quality view or stuck waiting for their first scan cycle.

Three root causes (confirmed by reading master):

1. **Cold start, slow throughput.** `SEEDS_PER_RUN=4` with a 2×/day cron means 137 seeds × full sweep = ~17 days. Categories whose seeds were just added (PR #56 on 2026-05-09) have effectively zero coverage.
2. **Shorts seeds are missing for several categories.** `fitness_health`, `luxury_lifestyle`, parts of `finance` only have longform seeds. The Shorts side of those buckets gets nothing.
3. **Niche label quality is degraded.** `discover/index.ts` inserts `niche_label: ''` and defers labeling to a later clustering pipeline using only 5 video titles. Result: vague or empty labels even when channels are good.

## Goals

- Populate every category chip with **≥10 quality channels within 24h** of deploy.
- Cut full seed-sweep time from ~17 days to **~2–3 days**.
- Replace generic seeds with **title-pattern seeds** that match how viral niches actually phrase their hooks.
- Land non-empty, specific niche labels at insert time; backfill empty labels in existing rows.

## Non-goals

- Replacing the YouTube API with Apify (deferred — see prior brainstorming).
- Redesigning the niche embedding/clustering pipeline (only the labeling step is touched).
- UI changes beyond what naturally falls out (chip empty-states resolve themselves once data populates).
- Touching the scan job's metrics, RLS, or pricing tier gates.

## Architecture (three components)

```
                 ┌──────────────────────────────────────────────┐
                 │  channels_watchlist (existing)               │
                 │  - youtube_channel_id                        │
                 │  - category enum (ai_tools, finance, …)      │
                 │  - content_type (shorts | longform)          │
                 │  - niche_label                               │
                 └──────────────────────────────────────────────┘
                              ▲              ▲
                              │              │
   ┌──────────────────────────┴──┐   ┌──────┴────────────────────┐
   │  B. trending  (NEW)         │   │  A. discover (Sonar, EXISTS)│
   │                             │   │                             │
   │  videos.list?chart=         │   │  search.list?q=<seed>       │
   │    mostPopular              │   │  Per-seed video search →    │
   │  Per YouTube category →     │   │  channel hydration →        │
   │  channel hydration → insert │   │  insert (now with C+ label) │
   └─────────────────────────────┘   └─────────────────────────────┘
                                                │
                                                ▼
                                      ┌──────────────────────────┐
                                      │ C+. labeling (CHANGED)   │
                                      │ Anthropic call uses      │
                                      │ 15–20 video titles, fills│
                                      │ niche_label at insert    │
                                      └──────────────────────────┘
```

Three independent units. Each has one job, can be deployed and rolled back separately, and is tested independently.

---

## Component B — YouTube trending pre-population (new edge function)

**Purpose:** Bypass the cold-start wait. YouTube's `videos.list?chart=mostPopular&videoCategoryId=X` returns a curated list of high-velocity videos *right now*, per category. We hydrate the unique channels behind those videos and insert them into the watchlist.

**Where:** `nichesurage/supabase/functions/trending/index.ts` (new).

**Flow per run:**

1. For each `(videoCategoryId, regionCode)` pair we want to cover (mapping in `_shared/trendingCategoryMap.ts`, see below), fetch top 50 trending videos via `videos.list?chart=mostPopular&videoCategoryId=X&regionCode=US|DE&maxResults=50&part=snippet,statistics,contentDetails`.
2. Bucket each video by ISO 8601 duration: `< PT1M` → `content_type='shorts'`, `>= PT1M` → `content_type='longform'`. (`chart=mostPopular` doesn't accept `videoDuration`, so we post-filter from a single call instead of making two.)
3. Deduplicate by `(channelId, content_type)` — a channel that produces both formats can appear once per format. Skip pairs already in `channels_watchlist`.
4. Hydrate each unique channel via `getChannelStats(...)` — one batch per 50 channels.
5. Apply the same gates as `discover`:
   - `MAX_VIDEO_COUNT_LONGFORM=200` (anti-aggregator).
   - `subscriberCount` between content-type-aware floor (5K shorts / 2K longform) and 400K ceiling.
   - `channel_created_at` within max age (24m longform, 12m shorts).
6. Resolve bucket via `videoCategoryId → CategoryBucketId` map (next section); pick the bucket's first `enumValues[]` entry as the row's `category` column.
7. Run niche labeling (component C+) before insert.
8. Insert with `niche_label`, `category`, `content_type`, `seed_keyword='__trending_<categoryId>'` for traceability.

**YouTube category → app bucket mapping:**

| YouTube `videoCategoryId` | YouTube label              | App bucket id      |
|---------------------------|----------------------------|--------------------|
| 28                        | Science & Technology       | `tech-ai`          |
| 27                        | Education                  | `education`        |
| 26                        | Howto & Style              | `lifestyle`        |
| 22                        | People & Blogs             | `lifestyle`        |
| 17                        | Sports                     | `health`           |
| 24                        | Entertainment              | `entertainment`    |
| 25                        | News & Politics            | `entertainment`    |
| 20                        | Gaming                     | `gaming`           |
| 10                        | Music                      | (skipped — out of scope) |

Each mapping line picks the *first* `enumValues[]` from `CATEGORY_BUCKETS` as the row's `category` (e.g. `tech-ai → ai_tools`). Sub-categorization within a bucket (`ai_tools` vs `tech_reviews`) is left to the labeling step / later clustering — good enough for chip filtering, which is what users see.

**Finance is a problem.** YouTube has no Finance category. We rely on Sonar (component A) for finance coverage. Health is partly covered by category 17 (Sports) plus Howto & Style; the "fitness" sub-segment will lean on Sonar.

**Regions:** `US`, `DE`, `UK`. US + DE matches existing Sonar coverage; UK adds a third English-speaking trending culture (often diverges from US for Lifestyle/Entertainment) at marginal quota cost.

**Quota cost (rough):**

- `videos.list?chart=mostPopular`: 1 unit per call × ~9 categories × 3 regions = 27 units per run.
- Channel hydration: ~50 channels × 1 unit / 50 batch ≈ 1 unit per category-region = ~27 units.
- Total per run ≈ 60–80 units. Runs 1×/day. Well below the 10K/day limit.

**Cron:** 1×/day, separate from `discover` cron, offset by 6h to avoid quota collisions.

---

## Component A — Pipeline acceleration (existing discover function)

**Purpose:** Sweep the 137 seed keywords faster, and add Shorts coverage to the categories that lack it.

### A.1 — Bump `SEEDS_PER_RUN`

Change Supabase env var: `SEEDS_PER_RUN=25` (was `4`).

Throughput math at 2×/day cron:
- Old: 4 seeds × 2 = 8/day → 137 seeds = ~17 days.
- New: 25 seeds × 2 = 50/day → 137 seeds = **~2.7 days** for a full sweep.

Quota check at 25 seeds/run: per existing seed flow, ~6 units/seed (one search + hydration) → 25 × 6 = 150 units × 2 runs = 300/day. Still well under 10K/day.

### A.2 — Shorts seeds migration

New migration: `nichesurage/supabase/migrations/0041_shorts_seeds_for_underserved_categories.sql`.

Adds Shorts-flavored seeds (short-form title patterns) for buckets that today are longform-only or thin:

- **Health (`fitness_health`):** ~12 seeds. Title patterns like `"day 1 of"`, `"i tried [diet] for"`, `"workout for"`, `"this is why you can't"`.
- **Lifestyle (`luxury_lifestyle`, `self_improvement`):** ~10 seeds. `"a day in my life"`, `"morning routine"`, `"things I wish I knew"`, `"what I eat in a day"`.
- **Finance (`finance`):** ~8 Shorts seeds. `"how to make $X"`, `"side hustle"`, `"financial mistake"`.

Each row inserted with `content_type='shorts'`, `language='en'` and `'de'` variants where the phrasing translates cleanly.

Seeds use **title-pattern phrasing**, not generic topic words — this is the C+ part of seed quality.

### A.3 — One-shot admin sweep trigger

New endpoint inside the existing discover function (or a thin wrapper): `POST /functions/v1/discover?mode=full-sweep` with `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.

When invoked, it ignores `SEEDS_PER_RUN` and processes **all active seeds in one run**, in batches of 25 with a 5s sleep between batches to stay polite. Quota still well within budget (~800 units for 137 seeds).

Used **once after deploy** to fully populate the watchlist immediately, then disabled-by-default for routine operation.

---

## Component C+ — Quality enhancements

### C+.1 — Niche labeling at insert

**Where:** Both `discover/index.ts` (Sonar path) and the new `trending/index.ts` call a shared helper.

**Before:** `niche_label: ''` — channels show up in /discover with empty labels until a later clustering job runs.

**After:** New helper `_shared/labeling.ts` `buildNicheLabel(channelName, recentTitles, seedKeyword)`:

1. Pull **15–20 recent video titles** via `getRecentVideos(uploadsPlaylistId, 20)` (already used in scan; we extend to discover insert too).
2. Call Anthropic Haiku with a tight prompt:
   > Given this channel and its recent video titles, produce a 2-4 word niche label that's specific, not generic. Examples of good: "AI prompt engineering", "frugal couple finance", "body recomp for women". Bad: "tech", "fitness", "lifestyle". If titles are inconsistent, pick the dominant pattern.
3. Return the label, capped at 40 chars, lowercased to match existing convention.

If labeling fails (network / quota), fall back to `seed_keyword` for Sonar inserts, or `''` for trending inserts. Better empty than a hallucinated wrong label.

**Cost:** Haiku is cheap (~$0.25 / 1M input tokens). 20 titles avg ~8 tokens each = 160 tokens × ~150 channels/day = 24K tokens/day. Cents per day.

### C+.2 — Backfill empty labels

New one-shot script (`nichesurage/scripts/backfillNicheLabels.ts`, run locally with service role key — not deployed):

```
SELECT id, youtube_channel_id, channel_name FROM channels_watchlist
WHERE niche_label = '' OR niche_label IS NULL
ORDER BY created_at DESC
LIMIT 500;
```

For each row: fetch 20 recent titles via YouTube API, call labeling helper, `UPDATE` the row.

Run once after deploy. Logs progress + failure summary. No cron.

### C+.3 — Better seed phrasing (title patterns)

New migration: `nichesurage/supabase/migrations/0042_title_pattern_seeds.sql`.

For seeds that are obviously generic (audit by hand: ~30 of the 137), insert sibling rows with title-pattern phrasing alongside the originals. Don't delete originals — let priority + dedup handle it.

Example transform:
- Generic: `"weight loss tips"` → Title patterns: `"i lost 30 pounds"`, `"why you can't lose weight"`, `"realistic weight loss"`.
- Generic: `"crypto news"` → Title patterns: `"bitcoin just"`, `"this altcoin is"`, `"crypto crashed"`.

Audit + seed list happens during implementation; this design just commits to the migration.

---

## Data flow (post-deploy)

1. **T+0 (deploy):** Migrations 0041 (shorts seeds) + 0042 (title-pattern seeds) applied. New `trending` edge function deployed. `discover/index.ts` updated to call labeling helper. Env var `SEEDS_PER_RUN=25`.
2. **T+0 (admin trigger):** Operator runs one-shot full sweep (`?mode=full-sweep`) → ~150–300 channels inserted with niche labels.
3. **T+0 (admin trigger):** Operator runs trending function once → ~80–150 trending channels inserted.
4. **T+0 (admin script):** Operator runs `backfillNicheLabels.ts` → existing empty labels filled.
5. **T+0 to T+24h:** First scan cron pass picks up new channels (every 1h cron); they appear in `/discover` as scan_results land.
6. **T+24h onward:** Trending cron 1×/day refreshes top videos; discover cron 2×/day rotates seeds at 25/run; full sweep complete in ~3 days.

## Risks & rollback

| Risk | Mitigation |
|------|------------|
| Trending function pulls junk channels (e.g., Music, Vlogs that don't fit any niche). | YouTube category filter + same gates as discover. Spot-check first run before enabling cron. |
| Labeling Haiku call fails for many channels and slows discover insert. | 5s timeout per call, fall back to `seed_keyword` or `''`. Insert is non-blocking on labeling failure. |
| Title-pattern seeds return same channels as existing generic seeds (wasted quota). | Existing `existingIds` dedup in discover already handles this. Net cost: ~half a quota unit per dup. Acceptable. |
| `SEEDS_PER_RUN=25` hits quota cliff if other things change. | Daily quota usage monitored; instant rollback via env var. |
| Backfill script touches the wrong rows. | Hard `WHERE niche_label IS NULL OR niche_label = ''` clause + dry-run flag default. |

**Rollback plan:** Each component has a clean revert.
- `SEEDS_PER_RUN`: change env var back to `4`.
- `trending` function: disable cron + delete deployment.
- Migrations 0041 / 0042: down-migrations drop only the rows they inserted (tagged with a marker comment).
- Labeling helper: feature flag `ENABLE_AT_INSERT_LABELING=false` reverts to `niche_label: ''`.

## Resolved decisions

- **Trending regions:** US + DE + UK.
- **Backfill script:** Node, run locally with Supabase JS client and service role key. Not deployed.
- **Trending row traceability:** `seed_keyword='__trending_<categoryId>'` synthetic marker.

## Out of scope (deferred)

- Apify integration.
- Embedding-based niche clustering refresh (separate from labeling).
- UI changes beyond what naturally improves once data populates.
- Discover dropdown menu work (mentioned in prior session — separate spec).
