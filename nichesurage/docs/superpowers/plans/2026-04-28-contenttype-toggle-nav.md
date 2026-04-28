# ContentType Toggle Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user clicks the Shorts/Longform toggle in SearchFilters, immediately navigate to the correct `/discover/[type]` route, carrying all other filter values as URL search params, and auto-trigger search on arrival.

**Architecture:** A new `filterParams.ts` helper provides two pure functions — `filtersToParams` (serialise SearchFilters → URLSearchParams) and `paramsToFilters` (deserialise back, with per-page defaults). Both discover pages intercept `contentType` changes to call `router.push`, initialise their filter state from URL params on mount, and auto-search when URL params are present. `SearchFilters` component is untouched.

**Tech Stack:** Next.js 14 (`useRouter`, `useSearchParams`), TypeScript, Jest.

---

## File Map

| File | Action |
|---|---|
| `src/lib/supabase/filterParams.ts` | Create |
| `src/lib/supabase/filterParams.test.ts` | Create |
| `src/app/discover/shorts/page.tsx` | Modify |
| `src/app/discover/longform/page.tsx` | Modify |

---

### Task 1: filterParams helper (TDD)

**Files:**
- Create: `src/lib/supabase/filterParams.ts`
- Create: `src/lib/supabase/filterParams.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/supabase/filterParams.test.ts`:

```typescript
import { filtersToParams, paramsToFilters } from './filterParams'
import type { SearchFilters } from '@/lib/types'

const SHORTS_DEFAULTS = { subscriberMin: 1000, subscriberMax: 100000 }
const LONGFORM_DEFAULTS = { subscriberMin: 1000, subscriberMax: 500000 }

const BASE_FILTERS: SearchFilters = {
  contentType: 'shorts',
  subscriberMin: 1000,
  subscriberMax: 100000,
  channelAge: 'any',
  onlyRecentlyViral: false,
}

describe('filtersToParams', () => {
  it('serializes subscriberMin, subscriberMax, channelAge, viral', () => {
    const params = filtersToParams(BASE_FILTERS)
    expect(params.get('subscriberMin')).toBe('1000')
    expect(params.get('subscriberMax')).toBe('100000')
    expect(params.get('channelAge')).toBe('any')
    expect(params.get('viral')).toBe('false')
  })

  it('does not include contentType in output', () => {
    const params = filtersToParams(BASE_FILTERS)
    expect(params.has('contentType')).toBe(false)
  })

  it('serializes viral=true', () => {
    const params = filtersToParams({ ...BASE_FILTERS, onlyRecentlyViral: true })
    expect(params.get('viral')).toBe('true')
  })
})

describe('paramsToFilters', () => {
  it('roundtrip: paramsToFilters(filtersToParams(filters)) returns identical object', () => {
    const params = filtersToParams(BASE_FILTERS)
    const result = paramsToFilters(params, 'shorts', SHORTS_DEFAULTS)
    expect(result).toEqual(BASE_FILTERS)
  })

  it('uses provided contentType argument, not from params', () => {
    const params = filtersToParams(BASE_FILTERS)
    const result = paramsToFilters(params, 'longform', LONGFORM_DEFAULTS)
    expect(result.contentType).toBe('longform')
  })

  it('falls back to defaults when params are empty', () => {
    const params = new URLSearchParams()
    const result = paramsToFilters(params, 'shorts', SHORTS_DEFAULTS)
    expect(result).toEqual({
      contentType: 'shorts',
      subscriberMin: 1000,
      subscriberMax: 100000,
      channelAge: 'any',
      onlyRecentlyViral: false,
    })
  })

  it('falls back to any when channelAge is invalid', () => {
    const params = new URLSearchParams({
      subscriberMin: '5000',
      subscriberMax: '200000',
      channelAge: 'invalid',
      viral: 'false',
    })
    const result = paramsToFilters(params, 'shorts', SHORTS_DEFAULTS)
    expect(result.channelAge).toBe('any')
  })

  it('parses viral=false as false (not falsy coercion)', () => {
    const params = new URLSearchParams({
      subscriberMin: '1000',
      subscriberMax: '100000',
      channelAge: 'any',
      viral: 'false',
    })
    const result = paramsToFilters(params, 'shorts', SHORTS_DEFAULTS)
    expect(result.onlyRecentlyViral).toBe(false)
  })

  it('parses viral=true as true', () => {
    const params = new URLSearchParams({
      subscriberMin: '1000',
      subscriberMax: '100000',
      channelAge: 'any',
      viral: 'true',
    })
    const result = paramsToFilters(params, 'shorts', SHORTS_DEFAULTS)
    expect(result.onlyRecentlyViral).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/lib/supabase/filterParams.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module './filterParams'`

- [ ] **Step 3: Implement filterParams.ts**

Create `src/lib/supabase/filterParams.ts`:

```typescript
import type { SearchFilters, ChannelAge, ContentType } from '@/lib/types'

const VALID_CHANNEL_AGES: ChannelAge[] = ['1month', '3months', '6months', '1year', 'any']

interface ReadableParams {
  get(name: string): string | null
  has(name: string): boolean
}

interface FilterDefaults {
  subscriberMin: number
  subscriberMax: number
}

export function filtersToParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams()
  params.set('subscriberMin', String(filters.subscriberMin))
  params.set('subscriberMax', String(filters.subscriberMax))
  params.set('channelAge', filters.channelAge)
  params.set('viral', String(filters.onlyRecentlyViral))
  return params
}

export function paramsToFilters(
  params: ReadableParams,
  contentType: ContentType,
  defaults: FilterDefaults,
): SearchFilters {
  const channelAge = params.get('channelAge')
  return {
    contentType,
    subscriberMin: params.has('subscriberMin')
      ? Number(params.get('subscriberMin'))
      : defaults.subscriberMin,
    subscriberMax: params.has('subscriberMax')
      ? Number(params.get('subscriberMax'))
      : defaults.subscriberMax,
    channelAge: VALID_CHANNEL_AGES.includes(channelAge as ChannelAge)
      ? (channelAge as ChannelAge)
      : 'any',
    onlyRecentlyViral: params.get('viral') === 'true',
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/lib/supabase/filterParams.test.ts --no-coverage
```

Expected: PASS — 9 tests, 0 failures

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npx jest --no-coverage
```

Expected: All tests pass (was 39 before this task, now 48)

- [ ] **Step 6: Commit**

```bash
git add nichesurage/src/lib/supabase/filterParams.ts nichesurage/src/lib/supabase/filterParams.test.ts
git commit -m "feat: add filterParams — URL serialization for SearchFilters"
```

---

### Task 2: Wire shorts/page.tsx

**Files:**
- Modify: `src/app/discover/shorts/page.tsx`

- [ ] **Step 1: Replace the file with the updated version**

Replace the full contents of `src/app/discover/shorts/page.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SearchFilters } from '@/components/search/SearchFilters'
import { NicheCard } from '@/components/niche/NicheCard'
import { NicheCardSkeleton } from '@/components/niche/NicheCardSkeleton'
import { fetchNiches } from '@/lib/supabase/queries'
import { filtersToParams, paramsToFilters } from '@/lib/supabase/filterParams'
import type { SearchFilters as SearchFiltersType, NicheCardData } from '@/lib/types'

const SHORTS_DEFAULTS = { subscriberMin: 1000, subscriberMax: 100000 }

export default function ShortsDiscoverPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [filters, setFilters] = useState<SearchFiltersType>(() =>
    paramsToFilters(searchParams, 'shorts', SHORTS_DEFAULTS)
  )
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

  function handleFiltersChange(updated: SearchFiltersType) {
    if (updated.contentType !== 'shorts') {
      router.push(`/discover/longform?${filtersToParams(updated)}`)
      return
    }
    setFilters(updated)
  }

  useEffect(() => {
    if (searchParams.size > 0) {
      handleSearch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">
        🎬 Shorts Niche Discovery
      </h1>
      <p className="text-slate-400 text-sm mb-6">
        Find viral Shorts niches. Set your filters and search.
      </p>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <SearchFilters value={filters} onChange={handleFiltersChange} />
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

Expected: All 48 tests pass

- [ ] **Step 3: Commit**

```bash
git add nichesurage/src/app/discover/shorts/page.tsx
git commit -m "feat: wire shorts page — URL params init, contentType nav, auto-search"
```

---

### Task 3: Wire longform/page.tsx

**Files:**
- Modify: `src/app/discover/longform/page.tsx`

- [ ] **Step 1: Replace the file with the updated version**

Replace the full contents of `src/app/discover/longform/page.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SearchFilters } from '@/components/search/SearchFilters'
import { NicheCard } from '@/components/niche/NicheCard'
import { NicheCardSkeleton } from '@/components/niche/NicheCardSkeleton'
import { fetchNiches } from '@/lib/supabase/queries'
import { filtersToParams, paramsToFilters } from '@/lib/supabase/filterParams'
import type { SearchFilters as SearchFiltersType, NicheCardData } from '@/lib/types'

const LONGFORM_DEFAULTS = { subscriberMin: 1000, subscriberMax: 500000 }

export default function LongformDiscoverPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [filters, setFilters] = useState<SearchFiltersType>(() =>
    paramsToFilters(searchParams, 'longform', LONGFORM_DEFAULTS)
  )
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

  function handleFiltersChange(updated: SearchFiltersType) {
    if (updated.contentType !== 'longform') {
      router.push(`/discover/shorts?${filtersToParams(updated)}`)
      return
    }
    setFilters(updated)
  }

  useEffect(() => {
    if (searchParams.size > 0) {
      handleSearch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">
        🎥 Longform Niche Discovery
      </h1>
      <p className="text-slate-400 text-sm mb-6">
        Find high-potential Longform niches. Set your filters and search.
      </p>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <SearchFilters value={filters} onChange={handleFiltersChange} />
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

Expected: All 48 tests pass

- [ ] **Step 3: Commit**

```bash
git add nichesurage/src/app/discover/longform/page.tsx
git commit -m "feat: wire longform page — URL params init, contentType nav, auto-search"
```
