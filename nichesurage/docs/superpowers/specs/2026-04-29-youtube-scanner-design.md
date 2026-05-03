# YouTube Scanner — Design Spec
**Date:** 2026-04-29  
**Status:** Approved

## Overview

Automated YouTube channel scanner that discovers small, fast-growing channels and populates the `scan_results` table hourly. Built as two Supabase Edge Functions scheduled via pg_cron — a daily discovery pass and an hourly metrics refresh.

---

## Goals

- Discover channels that are **new** (< 1 year for Shorts, < 2 years for Longform) and **spiking** (high views relative to their average)
- Cover all 4 content combinations: Shorts EN, Shorts DE, Longform EN, Longform DE
- Stay within YouTube Data API free quota (10,000 units/day)
- Auto-label each niche via Claude Haiku
- Keep total Claude cost under $0.50/month

---

## New Database Table

```sql
create table public.channels_watchlist (
  id uuid primary key default gen_random_uuid(),
  youtube_channel_id text not null unique,
  channel_name text not null,
  niche_label text not null default '',
  content_type text not null check (content_type in ('shorts', 'longform')),
  language text not null check (language in ('en', 'de')),
  first_discovered_at timestamptz not null default now(),
  last_scanned_at timestamptz,
  is_active boolean not null default true
);
```

`scan_results` is unchanged. Every hourly scan inserts a new row per channel (history preserved).

---

## Architecture

```
pg_cron
  ├── daily  06:00 UTC → discover edge function
  └── hourly 00 * * * → scan edge function
```

### `discover` (daily)

Runs once per day. Finds new channels and adds them to `channels_watchlist`.

**Steps:**
1. For each of 4 combinations (shorts/longform × en/de), run 5 `search.list` queries:
   - Shorts: `type=video`, `videoDuration=short`, `publishedAfter=2 days ago`, `order=viewCount`, `regionCode=US` (EN) or `regionCode=DE` (DE)
   - Longform: `type=video`, `videoDuration=long`, `publishedAfter=7 days ago`, `order=viewCount`, `regionCode=US` or `regionCode=DE`
   - No keyword (`q`) needed — regional + duration filters are sufficient
2. Extract channel IDs from results
3. Batch-fetch channel stats via `channels.list` (50 per call)
4. Filter out channels that don't qualify:
   - Shorts: subscriber_count > 100K OR channel older than 1 year
   - Longform: subscriber_count > 500K OR channel older than 2 years
5. For each **new** channel (not already in watchlist):
   - Call Claude Haiku with channel name + 5 top video titles → get `niche_label`
   - Insert into `channels_watchlist`

**Claude prompt:**
```
Given this YouTube channel name and its top video titles, return a short niche label (2-4 words, English).

Channel: {channel_name}
Top videos:
- {title_1}
- {title_2}
- {title_3}
- {title_4}
- {title_5}

Respond with only the niche label, nothing else.
```

**YouTube API quota (discover):**
- 4 combinations × 5 queries × 100 units = 2,000 units
- channels.list batches ≈ 50 units
- Total: ~2,050 units/day

### `scan` (hourly)

Runs every hour. Refreshes stats for all active watchlist channels.

**Steps:**
1. Read all `is_active = true` channels from `channels_watchlist`
2. Batch-fetch channel stats via `channels.list` (50 per call)
3. For each channel, fetch last 10 videos via `videos.list`
4. Compute metrics (see below)
5. Insert new row into `scan_results`
6. Update `last_scanned_at` in `channels_watchlist`

**YouTube API quota (scan):**
- 500 channels ÷ 50 per call = 10 calls × 24h = 240 units/day (channels.list)
- videos.list: same scale ≈ 240 units/day
- Total: ~480 units/day

**Total daily quota: ~2,530 / 10,000 units**

---

## Metrics Calculation

### Shared (Shorts + Longform)

| Field | Calculation |
|---|---|
| `views_48h` | Sum of views on videos published in last 48h |
| `views_avg` | Mean views across last 20 videos |
| `spike_multiplier` | `views_48h / views_avg` (capped at 50) |
| `engagement_rate` | `(likes + comments) / views` on last video |
| `virality_rating` | excellent ≥ 10×, good ≥ 3×, average otherwise |

### Shorts-specific

| Field | Calculation |
|---|---|
| `hook_score` | `(likes / views) × 100` on most recent video |
| `avg_view_duration_pct` | Not available via API — set null |

### Longform-specific

| Field | Calculation |
|---|---|
| `avg_views_per_video` | Mean views across all channel videos (from channel stats) |
| `competition_score` | `(subscriber_count / max_subs) × 100` — lower = less competition |
| `search_volume` | Not available via API — set null (future: SerpAPI integration) |

### opportunity_score (0–100)

```
spike_score = min(spike_multiplier / 20, 1) × 40   // 40 points max
size_score  = (1 - subs / max_subs)         × 30   // 30 points max
age_score   = (1 - channel_age_days / 365)  × 30   // 30 points max

opportunity_score = round(spike_score + size_score + age_score)
```

`max_subs`: 100,000 for Shorts, 500,000 for Longform.  
`channel_age_days` capped at 365 (older channels score 0 on age).

---

## Environment Variables

Set in Supabase Dashboard → Edge Functions → Secrets:

| Variable | Source |
|---|---|
| `YOUTUBE_API_KEY` | Google Cloud Console (already created) |
| `ANTHROPIC_API_KEY` | Anthropic Console |
| `SUPABASE_URL` | Supabase Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings → API (not anon key) |

---

## Error Handling

- **YouTube quota exceeded** — log error, stop function gracefully, retry next scheduled run
- **YouTube API network error** — log and skip, do not crash
- **Claude API failure** — skip labeling for that channel, set `niche_label = ''`, still add to watchlist
- **Individual channel scan failure** — log and skip, continue processing remaining channels
- No retries within a single invocation — pg_cron will retry on next scheduled run

---

## File Structure

```
nichesurage/
  supabase/
    functions/
      discover/
        index.ts          -- daily discovery function
      scan/
        index.ts          -- hourly scan function
    migrations/
      0003_channels_watchlist.sql
```

---

## Cost Summary

| Service | Est. daily cost | Est. monthly |
|---|---|---|
| YouTube Data API | $0 (within free quota) | $0 |
| Claude Haiku (labeling) | ~$0.015 | ~$0.45 |
| Supabase Edge Functions | $0 (within free tier) | $0 |
| **Total** | **~$0.015** | **~$0.45** |
