# Apify Discovery Engine — Design Spec

**Date:** 2026-05-18
**Status:** Approved (brainstorm complete, pending spec review)
**Author:** Brainstorm session, NicheSurage

## 1. Context & Problem

NicheSurage discovers YouTube channels via two edge functions:

- `discover` — rotates `seed_keywords`, calls YouTube Data API `search.list`, pre-screens
  candidates, labels niches, inserts into `channels_watchlist`.
- `trending` — scrapes YouTube `mostPopular` charts per category/region.

The bottleneck: YouTube Data API `search.list` costs **100 quota units per call**, against a
daily budget of ~10,000 units. This forces `SEEDS_PER_RUN=4` (4 seeds x 2 content types x 100
units = 800 units), leaving a ~17-day rotation through the seed pool. The channel universe is
small (~335 active channels) and grows slowly.

Three problems, confirmed with the user, are addressed together:

1. The universe is too small for the app to feel "full" and valuable.
2. Quota throttles discovery to a crawl.
3. Channel quality varies; some niches are thinly populated.

## 2. Goals & Non-Goals

### Goals

- Make Apify the primary channel-discovery engine, removing the `search.list` quota ceiling.
- Discovery is **coverage-driven**: it preferentially fills under-populated categories so every
  niche looks "full and proven."
- Predictable cost: stay within a configurable monthly Apify budget.
- Reuse the existing pre-screen gates, niche labeling, and category classification untouched.
- Respect Supabase free tier (short, decoupled edge-function invocations).

### Non-Goals

- `trending` stays on the YouTube Data API (`mostPopular` charts cost only ~21 units; not worth
  migrating).
- `yt-dlp` (`src/lib/discovery/ytdlp.ts`) stays as-is, used only for transcripts.
- No UI work, no Premium-locked-niche changes, no clustering changes.
- No change to `scan` — new channels flow into it automatically since `scan` reads the whole
  watchlist.

## 3. Locked Decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Architecture | Approach C: trigger + poll, two-phase, coverage-driven |
| Channel profile target | Focus on niches, not channels — every category well-populated; subscriber-range width is secondary |
| Apify budget | Apify Starter plan, $29/mo (the monthly fee is prepaid usage = the effective scraping budget) |
| Apify role | Replaces only the `search` step; channel hydration stays on YouTube Data API (cheap, 1 unit / 50 channels) |
| Taxonomy | Existing 12-value `category_enum`; Apify has no content-niche taxonomy to align with |
| Spec tier posture | Tier-agnostic: works on free tier, scales on Pro (see Tier Note) |

## 4. Architecture (Approach C)

Apify scrapes on its own infrastructure (a run takes 1-5 minutes). Edge-function invocations
stay short by decoupling the trigger from the ingest via a poll. No webhook infrastructure.

```
pg_cron --> discover-plan ---(Apify REST API)---> Apify Actor run (scrape, 1-5 min)
                                                       |
pg_cron --> discover-ingest ---(poll run status)-------+
   |--> YouTube API hydration --> existing gates --> niche label --> channels_watchlist
   |--> scan (existing) --> scan_results --> cluster-outliers (existing)
```

Relationship to existing code: during rollout the Apify path runs alongside the legacy
`discover` keyword-search. Once the Apify path is proven, the legacy `search.list` call is
retired, freeing the entire YouTube quota for hydration and `scan`.

## 5. Components

### 5.1 `apify_runs` table (new migration)

Tracks the lifecycle of every Apify run and supports both the poll and monthly cost tracking.

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid PK, default `gen_random_uuid()` | |
| `apify_run_id` | text, unique | Apify run identifier |
| `actor_id` | text | Apify actor used |
| `status` | text, check in (`triggered`,`ingested`,`failed`) | Lifecycle state |
| `query_plan` | jsonb | What was targeted: categories + queries + per-category query counts |
| `triggered_at` | timestamptz, default `now()` | |
| `ingested_at` | timestamptz, nullable | Set when ingest completes |
| `dataset_item_count` | int, nullable | Items returned by the run |
| `channels_added` | int, nullable | Net new rows inserted into `channels_watchlist` |
| `cost_usd` | numeric, nullable | Run cost read from Apify run stats |
| `error` | text, nullable | Failure reason |

RLS: service role writes; authenticated read (mirrors `seed_keywords` policy).

### 5.2 `discover-plan` edge function (new, Deno, pg_cron)

Runs 2x/day. Steps:

1. **Budget guard.** Sum `cost_usd` of `apify_runs` rows for the current calendar month. If it
   exceeds `APIFY_MONTHLY_BUDGET_USD`, log and exit without triggering.
2. **Kill-switch guard.** If `APIFY_DISCOVERY_ENABLED` is not `true`, log and exit.
3. **Coverage analysis.** Count active channels per category in `channels_watchlist`
   (`evicted_at IS NULL`, grouped by `category`). Compute
   `deficit = max(0, TARGET_PER_CATEGORY - count)` per category.
4. **Query plan.** Allocate this run's query budget (`QUERIES_PER_RUN`) across categories
   proportionally to deficit. For each allocated slot, pick a least-recently-used `seed_keywords`
   row tagged with that category (`ORDER BY last_used_at ASC NULLS FIRST`).
5. **Trigger.** Start one Apify actor run via the Apify REST API
   (`POST /v2/acts/{actorId}/runs`) with input = the chosen search terms + result limits.
6. **Record.** Insert an `apify_runs` row (`status='triggered'`, `query_plan` populated).
   Update `last_used_at = now()` for the chosen `seed_keywords`.

The function returns immediately after the trigger POST — it does not wait for the scrape.

### 5.3 `discover-ingest` edge function (new, Deno, pg_cron)

Runs every 2h. Idempotent and safe to retry. Steps:

1. Select `apify_runs` rows with `status='triggered'`.
2. For each, `GET` the run status from the Apify REST API.
   - **Running:** skip (will be picked up by a later invocation).
   - **Failed, or `triggered_at` older than `APIFY_RUN_TIMEOUT_HOURS` (default 24):** set
     `status='failed'`, log, continue.
   - **Succeeded:** fetch dataset items (`GET /v2/datasets/{id}/items`).
3. Extract candidate channels from dataset items (channel id / handle, channel title).
   Deduplicate against existing `channels_watchlist` by `youtube_channel_id`.
4. Hydrate via YouTube Data API: `getChannelStats` (1 unit / 50 channels) and `getRecentVideos`
   for labeling input.
5. Apply the existing pre-screen gates (`premiumSpike` filter, subscriber bounds, channel age,
   video-count caps, VPS thresholds). Per the niche-focus decision, subscriber bounds are
   relaxed relative to the legacy "young rising creator" profile — see Open Question O-3.
6. `buildNicheLabel` + `classifyChannelCategory` (existing Claude Haiku helpers).
7. Insert surviving channels into `channels_watchlist` with `discovered_via='apify_search'` and
   `seed_keyword` set to the originating term.
8. Update the `apify_runs` row: `status='ingested'`, `ingested_at`, `dataset_item_count`,
   `channels_added`, `cost_usd` (read from Apify run stats).

## 6. Coverage-Driven Targeting

The heart of the system. Categories are the targeting unit (the 12-value `category_enum`),
not `niche_clusters` — clusters are emergent and fuzzy, categories are stable.

- `TARGET_PER_CATEGORY` (env, e.g. 400) defines a "full" category. 12 x 400 ≈ 4,800-channel
  universe target.
- While the universe is sparse, every category has a large deficit; query budget spreads
  roughly evenly with a tilt toward the emptiest. As categories reach target, their deficit
  goes to 0 and they stop receiving queries — the system self-transitions from "fill" mode to
  "maintenance" mode (only topping up categories that drop below target via eviction/decay).

This directly serves the user's success criterion: every niche full and proven.

## 7. Phase 0 — Seed Keyword Expansion (prerequisite)

Coverage targeting can only generate queries for categories that have `seed_keywords`. Current
distribution (from migration 0038's verification query) is severely uneven:

| Category | Seed count |
|---|---|
| `education_howto` | 13 |
| `finance` | 13 |
| `ai_tools` | 9 |
| `true_crime` | 6 |
| `gaming_streamers` | 4 |
| `self_improvement` | 1 |
| `crypto` | 0 |
| `tech_reviews` | 0 |
| `fitness_health` | 0 |
| `luxury_lifestyle` | 0 |
| `celebrity_drama` | 0 |
| `geopolitics_news` | 0 |

Six categories have **zero** seeds — coverage targeting cannot fill them at all. Before the
Apify path goes live, the seed pool must be expanded so every category has a healthy set
(target: at least ~10-15 active seeds per category, English).

Approach: a one-off seeding migration. Seed terms are generated with Claude (a prompt that
produces YouTube-search-style phrases per category), then reviewed and committed as an
`INSERT` migration with `category` set. This is a discrete first task in the implementation
plan, independent of the edge-function work.

## 8. Apify Actor & Integration

- The concrete actor is chosen during implementation by inspecting the current Apify Store
  YouTube actors and their input/output schemas. Requirement: accepts a list of search terms
  (or search URLs) and returns video results carrying channel identity.
- Auth: a single secret `APIFY_API_TOKEN` (Apify personal API token), added by the user to
  Supabase function secrets. Never pasted into chat or committed.
- Integration is via the Apify REST API directly from the edge functions — no Apify-side
  scheduled tasks, no webhooks, no MCP, no third-party connectors.

## 9. Cost Control & Kill Switch

Three independent layers:

1. **App budget guard.** `discover-plan` sums month-to-date `cost_usd` from `apify_runs` and
   skips triggering once `APIFY_MONTHLY_BUDGET_USD` (default 25, deliberately below the $29
   Starter ceiling) is reached.
2. **Kill switch.** `APIFY_DISCOVERY_ENABLED` env flag — instant disable without a deploy.
3. **Apify-side hard cap.** The user sets a "Custom usage limit" in the Apify dashboard as a
   platform-level ceiling (belt and suspenders).

## 10. Cadence (pg_cron)

| Job | Schedule | Notes |
|---|---|---|
| `discover-plan` | 2x/day | Triggers one Apify run per invocation |
| `discover-ingest` | every 2h | Picks up any finished `triggered` runs; idempotent |
| legacy `discover` | unchanged during rollout | Retired after the Apify path is proven |

A run triggered by `discover-plan` finishes well within the 2h `discover-ingest` cycle.

## 11. Error Handling & Idempotency

- `discover-ingest` is safe to retry: channel-level dedup is by `youtube_channel_id`; the
  `apify_runs.status` transition (`triggered` -> `ingested`) prevents double-import.
- A run that fails on Apify, or stays `triggered` past `APIFY_RUN_TIMEOUT_HOURS`, is marked
  `failed` and does not block other runs.
- Apify API or YouTube API errors during ingest are logged; the run stays `triggered` for a
  later retry rather than being lost (unless past timeout).

## 12. Testing Strategy

- Unit tests for pure functions: coverage-deficit allocation, query-plan builder, month-to-date
  cost-sum guard, ingest channel dedup. Apify REST API responses are mocked.
- Existing gate functions (`premiumSpike`, VPS, age) already have tests — reuse, no new tests.
- Pre-production manual proof run on the Apify Free plan: one small `discover-plan` ->
  `discover-ingest` cycle, verifying channels actually land in `channels_watchlist` with the
  correct `category` and `discovered_via='apify_search'`.

## 13. Tier Note

The spec works on the free tier of both Supabase and Vercel; batch sizes (`QUERIES_PER_RUN`,
channels hydrated per ingest) are kept modest so edge-function invocations stay short.

- **Vercel:** Pro is already active — no action.
- **Apify:** Free plan ($5/mo hard cap) is sufficient for development and the proof run only.
  Before production rollout, upgrade to **Starter ($29/mo)** — the monthly fee is prepaid usage
  and becomes the effective scraping budget. The Free plan's $5 cap cannot sustain production
  discovery, and some rented Store actors are limited on Free.
- **Supabase:** Pro ($25/mo) is **not** required to build or launch this. It becomes advisable
  as a consequence of success: a larger universe makes `scan` write far more `video_snapshots`
  and `scan_results` rows, pressuring the free tier's 500MB database limit and edge-function
  compute budget. Recommended upgrade trigger: database size approaching ~400MB, or when `scan`
  throughput needs to rise.

Approximate all-in monthly infrastructure once fully scaled: Vercel Pro $20 + Apify Starter
$29 + Supabase Pro $25 ≈ $74/mo. Break-even at ~4 Premium (€19/mo) subscribers.

## 14. Rollout

1. Phase 0: seed keyword expansion migration.
2. `apify_runs` migration.
3. `discover-plan` + `discover-ingest` edge functions.
4. Proof run on Apify Free plan; verify end-to-end.
5. Upgrade Apify to Starter; enable pg_cron jobs.
6. Run alongside legacy `discover` until the Apify path is proven.
7. Retire the legacy `search.list` call in `discover`.

## 15. Open Questions & Risks

- **O-1 (actor output):** an Apify YouTube actor may return a channel handle/URL rather than a
  `UC...` id. channelId resolution is settled when the concrete actor is chosen; YouTube
  `channels.list` supports `forHandle` as a fallback.
- **O-2 (in-flight cost window):** a run that is `triggered` but not yet `ingested` has no
  recorded `cost_usd`, so the budget guard slightly under-counts. The conservative default
  cap ($25 vs the $29 ceiling) and the slow 2x/day cadence absorb this.
- **O-3 (gate profile):** the niche-focus decision implies relaxing the legacy subscriber
  bounds. The exact relaxed bounds (and whether channel-age/video-count caps also loosen) are
  decided in the implementation plan, by reviewing the current gate constants.

## 16. Out of Scope

`trending` migration; `yt-dlp`-based discovery; Premium-locked niche reactivation; any UI work;
clustering changes; `scan` changes.
