# Supabase Fetch — Discover Pages

**Date:** 2026-04-28  
**Scope:** Replace mock `setTimeout` in `/discover/shorts` and `/discover/longform` with real Supabase queries using `SearchFilters`.

---

## Problem

`scan_results` table is missing columns added to `DbScanResult` TypeScript type in commit `8703cdb`:
- `content_type` (text, NOT NULL)
- `hook_score` (float, nullable)
- `avg_view_duration_pct` (float, nullable)
- `search_volume` (int, nullable)
- `competition_score` (int, nullable)

Both discover pages use a hardcoded `setTimeout` + mock data instead of real Supabase queries.

---

## Approach: Migration + query helper + client-side call

Chosen over API Route and RSC approaches because:
- RLS already protects data (authenticated-only reads)
- Pages are already `'use client'` — no refactor needed
- API route would add complexity with no security benefit at this stage

---

## Implementation

### 1. Migration `0002_add_content_type.sql`

Adds missing columns to `scan_results`:

```sql
ALTER TABLE public.scan_results
  ADD COLUMN content_type text NOT NULL DEFAULT 'shorts'
    CHECK (content_type IN ('shorts', 'longform')),
  ADD COLUMN hook_score float,
  ADD COLUMN avg_view_duration_pct float,
  ADD COLUMN search_volume int,
  ADD COLUMN competition_score int;
```

### 2. `src/lib/supabase/queries.ts`

Exports `fetchNiches(filters: SearchFilters): Promise<{ data: NicheCardData[], error: string | null }>`.

**Filter mapping:**

| SearchFilters field | Supabase filter |
|---|---|
| `contentType` | `.eq('content_type', contentType)` |
| `subscriberMin` | `.gte('subscriber_count', subscriberMin)` |
| `subscriberMax` | `.lte('subscriber_count', subscriberMax)` |
| `channelAge` (not 'any') | `.gte('channel_created_at', cutoffDate)` |
| `onlyRecentlyViral: true` | `.gte('spike_multiplier', 3).gte('scanned_at', 7 days ago)` |

**`subscriberRange` computation** (from `subscriber_count` integer):

| Range | Label |
|---|---|
| < 1K | `"<1K"` |
| 1K–5K | `"1K–5K"` |
| 5K–10K | `"5K–10K"` |
| 10K–50K | `"10K–50K"` |
| 50K–100K | `"50K–100K"` |
| 100K–500K | `"100K–500K"` |
| ≥ 500K | `"500K+"` |

**DB row → NicheCardData mapping:**

Common fields map directly (snake_case → camelCase). Discriminated union branching on `content_type`:
- `'shorts'` → `ShortsNicheCardData` with `hookScore`, `avgViewDurationPct`
- `'longform'` → `LongformNicheCardData` with `searchVolume`, `competitionScore`, `avgViewsPerVideo` (from `views_avg`)

Returns `{ data: [], error: message }` on Supabase error (never throws).

### 3. Discover pages

Both pages:
- `handleSearch` becomes `async`, calls `fetchNiches(filters)`
- On error: store error string in state, display below search button
- Remove `MOCK_RESULTS` constant and `setTimeout`
- `results` type changes from concrete array to `NicheCardData[]` (both pages share the same query function)

---

## Error handling

- Supabase error → `error` state → inline message in UI: `"Search failed. Please try again."`
- Empty results → existing "No niches found" empty state (unchanged)

---

## Testing

- Existing Jest tests for NicheCard components are unaffected (they don't touch fetch logic)
- `fetchNiches` is a pure async function — easy to unit test with a mocked Supabase client if needed later
- Manual test: run dev server, trigger search, verify cards appear with real data

---

## Files touched

| File | Action |
|---|---|
| `supabase/migrations/0002_add_content_type.sql` | Create |
| `src/lib/supabase/queries.ts` | Create |
| `src/app/discover/shorts/page.tsx` | Edit |
| `src/app/discover/longform/page.tsx` | Edit |
