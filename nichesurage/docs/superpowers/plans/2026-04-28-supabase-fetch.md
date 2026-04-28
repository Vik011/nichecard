# Supabase Fetch — Discover Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock `setTimeout` in `/discover/shorts` and `/discover/longform` with real Supabase queries filtered by `SearchFilters`.

**Architecture:** A migration adds missing columns to `scan_results`. A `queries.ts` helper fetches and maps rows to typed `NicheCardData`. Both discover pages call `fetchNiches(filters)` and handle loading/error state.

**Tech Stack:** Next.js 14 (`'use client'`), Supabase JS (`@supabase/ssr`), TypeScript, Jest + React Testing Library.

---

## File Map

| File | Action |
|---|---|
| `supabase/migrations/0002_add_content_type.sql` | Create |
| `src/lib/supabase/queries.ts` | Create |
| `src/lib/supabase/queries.test.ts` | Create |
| `src/app/discover/shorts/page.tsx` | Modify |
| `src/app/discover/longform/page.tsx` | Modify |

---

### Task 1: Migration — add content_type columns to scan_results

**Files:**
- Create: `supabase/migrations/0002_add_content_type.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/0002_add_content_type.sql
ALTER TABLE public.scan_results
  ADD COLUMN content_type text NOT NULL DEFAULT 'shorts'
    CHECK (content_type IN ('shorts', 'longform')),
  ADD COLUMN hook_score float,
  ADD COLUMN avg_view_duration_pct float,
  ADD COLUMN search_volume int,
  ADD COLUMN competition_score int;
```

- [ ] **Step 2: Apply migration to Supabase**

Run in Supabase SQL editor (Dashboard → SQL Editor) or via CLI:
```bash
npx supabase db push
```
Expected: migration applies without error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_add_content_type.sql
git commit -m "feat: add content_type and type-specific columns to scan_results"
```

---

### Task 2: queries.ts — toSubscriberRange (TDD)

**Files:**
- Create: `src/lib/supabase/queries.ts`
- Create: `src/lib/supabase/queries.test.ts`

- [ ] **Step 1: Create queries.ts with stub**

```typescript
// src/lib/supabase/queries.ts
export function toSubscriberRange(count: number): string {
  throw new Error('not implemented')
}
```

- [ ] **Step 2: Write failing test**

```typescript
// src/lib/supabase/queries.test.ts
import { toSubscriberRange } from './queries'

describe('toSubscriberRange', () => {
  it.each<[number, string]>([
    [0,       '<1K'],
    [500,     '<1K'],
    [999,     '<1K'],
    [1000,    '1K–5K'],
    [4999,    '1K–5K'],
    [5000,    '5K–10K'],
    [9999,    '5K–10K'],
    [10000,   '10K–50K'],
    [49999,   '10K–50K'],
    [50000,   '50K–100K'],
    [99999,   '50K–100K'],
    [100000,  '100K–500K'],
    [499999,  '100K–500K'],
    [500000,  '500K+'],
    [1000000, '500K+'],
  ])('count %i → %s', (count, expected) => {
    expect(toSubscriberRange(count)).toBe(expected)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest src/lib/supabase/queries.test.ts -t "toSubscriberRange" --no-coverage
```
Expected: FAIL — "not implemented"

- [ ] **Step 4: Implement toSubscriberRange**

Replace the stub in `src/lib/supabase/queries.ts`:

```typescript
export function toSubscriberRange(count: number): string {
  if (count < 1000)   return '<1K'
  if (count < 5000)   return '1K–5K'
  if (count < 10000)  return '5K–10K'
  if (count < 50000)  return '10K–50K'
  if (count < 100000) return '50K–100K'
  if (count < 500000) return '100K–500K'
  return '500K+'
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest src/lib/supabase/queries.test.ts -t "toSubscriberRange" --no-coverage
```
Expected: PASS (16 cases)

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/queries.ts src/lib/supabase/queries.test.ts
git commit -m "feat: add toSubscriberRange helper with tests"
```

---

### Task 3: queries.ts — mapRow (TDD)

**Files:**
- Modify: `src/lib/supabase/queries.ts`
- Modify: `src/lib/supabase/queries.test.ts`

- [ ] **Step 1: Add mapRow stub to queries.ts**

Append to `src/lib/supabase/queries.ts` (keep `toSubscriberRange` above):

```typescript
import type { NicheCardData, ShortsNicheCardData, LongformNicheCardData } from '@/lib/types'
import type { DbScanResult } from '@/lib/types/database'

export function mapRow(row: DbScanResult): NicheCardData {
  throw new Error('not implemented')
}
```

- [ ] **Step 2: Write failing mapRow tests**

Append to `src/lib/supabase/queries.test.ts`:

```typescript
import { mapRow } from './queries'
import type { DbScanResult } from '@/lib/types/database'

const baseRow: import('@/lib/types/database').DbScanResult = {
  id: 'abc',
  youtube_channel_id: 'yt1',
  channel_name: 'Test Channel',
  niche_label: 'Finance',
  channel_url: 'https://youtube.com/c/test',
  channel_created_at: '2023-01-01',
  video_count: 50,
  subscriber_count: 7500,
  views_48h: 10000,
  views_avg: 5000,
  spike_multiplier: 4.2,
  engagement_rate: 5.1,
  opportunity_score: 80,
  virality_rating: 'excellent',
  language: 'en',
  content_type: 'shorts',
  hook_score: null,
  avg_view_duration_pct: null,
  search_volume: null,
  competition_score: null,
  scanned_at: '2026-04-28T10:00:00Z',
}

describe('mapRow', () => {
  it('maps a shorts row to ShortsNicheCardData', () => {
    const row = { ...baseRow, content_type: 'shorts' as const, hook_score: 88, avg_view_duration_pct: 72 }
    const result = mapRow(row)
    expect(result.contentType).toBe('shorts')
    expect(result.subscriberRange).toBe('5K–10K')
    expect(result.id).toBe('abc')
    expect(result.channelName).toBe('Test Channel')
    if (result.contentType === 'shorts') {
      expect(result.hookScore).toBe(88)
      expect(result.avgViewDurationPct).toBe(72)
    }
  })

  it('maps a longform row to LongformNicheCardData', () => {
    const row = { ...baseRow, content_type: 'longform' as const, search_volume: 40000, competition_score: 25 }
    const result = mapRow(row)
    expect(result.contentType).toBe('longform')
    expect(result.subscriberRange).toBe('5K–10K')
    if (result.contentType === 'longform') {
      expect(result.searchVolume).toBe(40000)
      expect(result.competitionScore).toBe(25)
      expect(result.avgViewsPerVideo).toBe(5000)
    }
  })

  it('maps null type-specific fields to undefined', () => {
    const row = { ...baseRow, content_type: 'shorts' as const }
    const result = mapRow(row)
    if (result.contentType === 'shorts') {
      expect(result.hookScore).toBeUndefined()
      expect(result.avgViewDurationPct).toBeUndefined()
    }
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest src/lib/supabase/queries.test.ts -t "mapRow" --no-coverage
```
Expected: FAIL — "not implemented"

- [ ] **Step 4: Implement mapRow**

Replace the `mapRow` stub in `src/lib/supabase/queries.ts`:

```typescript
export function mapRow(row: DbScanResult): NicheCardData {
  const base = {
    id: row.id,
    channelCreatedAt: row.channel_created_at,
    videoCount: row.video_count,
    subscriberRange: toSubscriberRange(row.subscriber_count),
    spikeMultiplier: row.spike_multiplier,
    opportunityScore: row.opportunity_score,
    viralityRating: row.virality_rating,
    language: row.language,
    channelName: row.channel_name,
    nicheLabel: row.niche_label,
    channelUrl: row.channel_url,
    engagementRate: row.engagement_rate,
  }

  if (row.content_type === 'shorts') {
    return {
      ...base,
      contentType: 'shorts',
      hookScore: row.hook_score ?? undefined,
      avgViewDurationPct: row.avg_view_duration_pct ?? undefined,
    } satisfies ShortsNicheCardData
  }

  return {
    ...base,
    contentType: 'longform',
    searchVolume: row.search_volume ?? undefined,
    competitionScore: row.competition_score ?? undefined,
    avgViewsPerVideo: row.views_avg,
  } satisfies LongformNicheCardData
}
```

- [ ] **Step 5: Run all queries tests**

```bash
npx jest src/lib/supabase/queries.test.ts --no-coverage
```
Expected: PASS (all tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/queries.ts src/lib/supabase/queries.test.ts
git commit -m "feat: add mapRow — DB row to NicheCardData mapper with tests"
```

---

### Task 4: queries.ts — fetchNiches

**Files:**
- Modify: `src/lib/supabase/queries.ts`

- [ ] **Step 1: Add imports and fetchNiches to queries.ts**

Add at the top of `src/lib/supabase/queries.ts`:

```typescript
import { createClient } from './client'
import type { SearchFilters, ChannelAge } from '@/lib/types'
```

Then append `channelAgeCutoff` and `fetchNiches` after `mapRow`:

```typescript
function channelAgeCutoff(age: Exclude<ChannelAge, 'any'>): string {
  const days: Record<Exclude<ChannelAge, 'any'>, number> = {
    '1month': 30,
    '3months': 90,
    '6months': 180,
    '1year': 365,
  }
  const d = new Date()
  d.setDate(d.getDate() - days[age])
  return d.toISOString().split('T')[0]
}

export async function fetchNiches(
  filters: SearchFilters,
): Promise<{ data: NicheCardData[]; error: string | null }> {
  const supabase = createClient()

  let query = supabase
    .from('scan_results')
    .select('*')
    .eq('content_type', filters.contentType)
    .gte('subscriber_count', filters.subscriberMin)
    .lte('subscriber_count', filters.subscriberMax)
    .order('opportunity_score', { ascending: false })
    .limit(20)

  if (filters.channelAge !== 'any') {
    query = query.gte('channel_created_at', channelAgeCutoff(filters.channelAge))
  }

  if (filters.onlyRecentlyViral) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('spike_multiplier', 3).gte('scanned_at', sevenDaysAgo)
  }

  const { data, error } = await query

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []).map(mapRow), error: null }
}
```

- [ ] **Step 2: Run full test suite to verify nothing broke**

```bash
npx jest --no-coverage
```
Expected: all existing tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/queries.ts
git commit -m "feat: add fetchNiches — Supabase query with filter mapping"
```

---

### Task 5: Wire up /discover/shorts

**Files:**
- Modify: `src/app/discover/shorts/page.tsx`

- [ ] **Step 1: Replace the entire page file**

```typescript
'use client'

import { useState } from 'react'
import { SearchFilters } from '@/components/search/SearchFilters'
import { NicheCard } from '@/components/niche/NicheCard'
import { NicheCardSkeleton } from '@/components/niche/NicheCardSkeleton'
import { fetchNiches } from '@/lib/supabase/queries'
import type { SearchFilters as SearchFiltersType, NicheCardData } from '@/lib/types'

const DEFAULT_FILTERS: SearchFiltersType = {
  contentType: 'shorts',
  subscriberMin: 1000,
  subscriberMax: 100000,
  channelAge: 'any',
  onlyRecentlyViral: false,
}

export default function ShortsDiscoverPage() {
  const [filters, setFilters] = useState<SearchFiltersType>(DEFAULT_FILTERS)
  const [results, setResults] = useState<NicheCardData[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch() {
    setLoading(true)
    setSearched(true)
    setError(null)
    const { data, error: fetchError } = await fetchNiches(filters)
    setResults(data)
    setError(fetchError)
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">
        🎬 Shorts Niche Discovery
      </h1>
      <p className="text-slate-400 text-sm mb-6">
        Find viral Shorts niches. Set your filters and search.
      </p>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <SearchFilters value={filters} onChange={setFilters} />
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          {loading ? 'Searching…' : 'Search Niches'}
        </button>
        {error && (
          <p className="mt-3 text-red-400 text-sm text-center">{error}</p>
        )}
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <NicheCardSkeleton key={i} />)}
        </div>
      )}

      {!loading && searched && results.length === 0 && !error && (
        <p className="text-slate-500 text-center py-12">No niches found for these filters.</p>
      )}

      {!loading && results.length > 0 && (
        <div className="flex flex-col gap-3">
          {results.map((niche, i) => (
            <NicheCard key={niche.id} data={niche} userTier="basic" rank={i + 1} />
          ))}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Run test suite**

```bash
npx jest --no-coverage
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/discover/shorts/page.tsx
git commit -m "feat: wire /discover/shorts to real Supabase fetch"
```

---

### Task 6: Wire up /discover/longform

**Files:**
- Modify: `src/app/discover/longform/page.tsx`

- [ ] **Step 1: Replace the entire page file**

```typescript
'use client'

import { useState } from 'react'
import { SearchFilters } from '@/components/search/SearchFilters'
import { NicheCard } from '@/components/niche/NicheCard'
import { NicheCardSkeleton } from '@/components/niche/NicheCardSkeleton'
import { fetchNiches } from '@/lib/supabase/queries'
import type { SearchFilters as SearchFiltersType, NicheCardData } from '@/lib/types'

const DEFAULT_FILTERS: SearchFiltersType = {
  contentType: 'longform',
  subscriberMin: 1000,
  subscriberMax: 500000,
  channelAge: 'any',
  onlyRecentlyViral: false,
}

export default function LongformDiscoverPage() {
  const [filters, setFilters] = useState<SearchFiltersType>(DEFAULT_FILTERS)
  const [results, setResults] = useState<NicheCardData[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch() {
    setLoading(true)
    setSearched(true)
    setError(null)
    const { data, error: fetchError } = await fetchNiches(filters)
    setResults(data)
    setError(fetchError)
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">
        🎥 Longform Niche Discovery
      </h1>
      <p className="text-slate-400 text-sm mb-6">
        Find high-potential Longform niches. Set your filters and search.
      </p>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <SearchFilters value={filters} onChange={setFilters} />
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          {loading ? 'Searching…' : 'Search Niches'}
        </button>
        {error && (
          <p className="mt-3 text-red-400 text-sm text-center">{error}</p>
        )}
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <NicheCardSkeleton key={i} />)}
        </div>
      )}

      {!loading && searched && results.length === 0 && !error && (
        <p className="text-slate-500 text-center py-12">No niches found for these filters.</p>
      )}

      {!loading && results.length > 0 && (
        <div className="flex flex-col gap-3">
          {results.map((niche, i) => (
            <NicheCard key={niche.id} data={niche} userTier="basic" rank={i + 1} />
          ))}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/discover/longform/page.tsx
git commit -m "feat: wire /discover/longform to real Supabase fetch"
```
