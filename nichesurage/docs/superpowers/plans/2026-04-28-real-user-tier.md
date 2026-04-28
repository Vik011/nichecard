# Real User Tier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded `userTier="basic"` in discover pages with the real tier fetched from Supabase session via React Context.

**Architecture:** A `UserProvider` Client Component fetches the Supabase auth user on mount, queries `public.users` for their `tier`, and exposes it via `useUser()` hook. The root `layout.tsx` wraps children with `UserProvider` so the tier is available app-wide. Discover pages consume `useUser()` and show a skeleton while the tier loads, then pass the real tier to `NicheCard`.

**Tech Stack:** Next.js 14 App Router, React Context, `@supabase/ssr` (browser client), Jest + `@testing-library/react`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/context/UserContext.tsx` | Create | `UserProvider` + `useUser()` hook |
| `src/lib/context/UserContext.test.tsx` | Create | 4 test scenarios for the hook |
| `src/app/layout.tsx` | Modify | Wrap `{children}` with `UserProvider` |
| `src/app/discover/shorts/page.tsx` | Modify | Consume `useUser()`, gate search + skeleton |
| `src/app/discover/longform/page.tsx` | Modify | Same as shorts |

---

## Task 1: UserContext — Provider, hook, and tests

**Files:**
- Create: `nichesurage/src/lib/context/UserContext.tsx`
- Create: `nichesurage/src/lib/context/UserContext.test.tsx`

---

- [ ] **Step 1: Write the failing tests**

Create `nichesurage/src/lib/context/UserContext.test.tsx` with this exact content:

```typescript
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { UserProvider, useUser } from './UserContext'

jest.mock('@/lib/supabase/client')

import { createClient } from '@/lib/supabase/client'

const mockCreateClient = createClient as jest.Mock

function makeSupabaseMock({
  user = null as { id: string } | null,
  getUserError = null as object | null,
  dbTier = null as string | null,
} = {}) {
  const single = jest.fn().mockResolvedValue({
    data: dbTier ? { tier: dbTier } : null,
    error: null,
  })
  const eq = jest.fn().mockReturnValue({ single })
  const select = jest.fn().mockReturnValue({ eq })
  const from = jest.fn().mockReturnValue({ select })
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: getUserError,
      }),
    },
    from,
  }
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <UserProvider>{children}</UserProvider>
)

describe('useUser', () => {
  beforeEach(() => {
    mockCreateClient.mockReset()
  })

  it('returns tier:"basic" and loading:false for a logged-in basic user', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabaseMock({ user: { id: 'user-1' }, dbTier: 'basic' })
    )
    const { result } = renderHook(() => useUser(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tier).toBe('basic')
  })

  it('returns tier:"premium" and loading:false for a logged-in premium user', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabaseMock({ user: { id: 'user-2' }, dbTier: 'premium' })
    )
    const { result } = renderHook(() => useUser(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tier).toBe('premium')
  })

  it('returns tier:"free" and loading:false for an unauthenticated user', async () => {
    mockCreateClient.mockReturnValue(makeSupabaseMock({ user: null }))
    const { result } = renderHook(() => useUser(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tier).toBe('free')
  })

  it('returns tier:"free" and loading:false when getUser returns an error', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabaseMock({ getUserError: new Error('network error') })
    )
    const { result } = renderHook(() => useUser(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tier).toBe('free')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd nichesurage && npx jest src/lib/context/UserContext.test.tsx --no-coverage
```

Expected: `Cannot find module './UserContext'`

- [ ] **Step 3: Create UserContext.tsx**

Create `nichesurage/src/lib/context/UserContext.tsx` with this exact content:

```typescript
'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserTier } from '@/lib/types/database'

interface UserContextValue {
  tier: UserTier
  loading: boolean
}

const UserContext = createContext<UserContextValue>({ tier: 'free', loading: true })

export function UserProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<UserTier>('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function fetchTier() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return
        const { data } = await supabase
          .from('users')
          .select('tier')
          .eq('id', user.id)
          .single()
        if (data?.tier) {
          setTier(data.tier as UserTier)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchTier()
  }, [])

  return (
    <UserContext.Provider value={{ tier, loading }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd nichesurage && npx jest src/lib/context/UserContext.test.tsx --no-coverage
```

Expected: `4 passed, 4 total`

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
cd nichesurage && npx jest --no-coverage
```

Expected: all tests pass (same count as before + 4 new)

- [ ] **Step 6: Commit**

```bash
git add nichesurage/src/lib/context/UserContext.tsx nichesurage/src/lib/context/UserContext.test.tsx
git commit -m "feat: add UserProvider and useUser hook with tests"
```

---

## Task 2: Wrap root layout with UserProvider

**Files:**
- Modify: `nichesurage/src/app/layout.tsx`

---

- [ ] **Step 1: Add UserProvider import and wrap children**

The current `layout.tsx` is a Server Component. Wrapping `{children}` with a Client Component (`UserProvider`) is valid in Next.js 14 App Router — children are passed as RSC payloads and not re-rendered on the client.

Replace the entire content of `nichesurage/src/app/layout.tsx` with:

```typescript
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { UserProvider } from "@/lib/context/UserContext";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Run full test suite to confirm no regressions**

```bash
cd nichesurage && npx jest --no-coverage
```

Expected: all tests still pass

- [ ] **Step 3: Commit**

```bash
git add nichesurage/src/app/layout.tsx
git commit -m "feat: wrap root layout with UserProvider"
```

---

## Task 3: Wire real user tier in shorts discover page

**Files:**
- Modify: `nichesurage/src/app/discover/shorts/page.tsx`

Changes:
1. Import `useUser`
2. Destructure `{ tier: userTier, loading: userLoading }` from `useUser()`
3. Disable Search button while `userLoading`
4. Show skeleton while `userLoading || loading` (merged condition for results area)
5. Gate "no results" and results display on `!userLoading`
6. Auto-search `useEffect` depends on `[userLoading]` and skips if `userLoading`
7. Replace `userTier="basic"` with `userTier={userTier}`

---

- [ ] **Step 1: Replace shorts page content**

Replace the entire content of `nichesurage/src/app/discover/shorts/page.tsx` with:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SearchFilters } from '@/components/search/SearchFilters'
import { NicheCard } from '@/components/niche/NicheCard'
import { NicheCardSkeleton } from '@/components/niche/NicheCardSkeleton'
import { fetchNiches } from '@/lib/supabase/queries'
import { filtersToParams, paramsToFilters } from '@/lib/supabase/filterParams'
import { useUser } from '@/lib/context/UserContext'
import type { SearchFilters as SearchFiltersType, NicheCardData } from '@/lib/types'

const SHORTS_DEFAULTS = { subscriberMin: 1000, subscriberMax: 100000 }

export default function ShortsDiscoverPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { tier: userTier, loading: userLoading } = useUser()

  const [filters, setFilters] = useState<SearchFiltersType>(() =>
    paramsToFilters(searchParams, 'shorts', SHORTS_DEFAULTS)
  )
  const [results, setResults] = useState<NicheCardData[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch(filtersOverride?: SearchFiltersType) {
    const f = filtersOverride ?? filters
    setLoading(true)
    setSearched(true)
    setError(null)
    const { data, error: fetchError } = await fetchNiches(f)
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
    if (!userLoading && searchParams.size > 0) {
      handleSearch(paramsToFilters(searchParams, 'shorts', SHORTS_DEFAULTS))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading])

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
          onClick={() => handleSearch()}
          disabled={loading || userLoading}
          className="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          {loading ? 'Searching…' : 'Search Niches'}
        </button>
        {error && (
          <p className="mt-3 text-red-400 text-sm text-center">{error}</p>
        )}
      </div>

      {(userLoading || loading) && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <NicheCardSkeleton key={i} />)}
        </div>
      )}

      {!userLoading && !loading && searched && results.length === 0 && !error && (
        <p className="text-slate-500 text-center py-12">No niches found for these filters.</p>
      )}

      {!userLoading && !loading && results.length > 0 && (
        <div className="flex flex-col gap-3">
          {results.map((niche, i) => (
            <NicheCard key={niche.id} data={niche} userTier={userTier} rank={i + 1} />
          ))}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd nichesurage && npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add nichesurage/src/app/discover/shorts/page.tsx
git commit -m "feat: wire real user tier in shorts discover page"
```

---

## Task 4: Wire real user tier in longform discover page

**Files:**
- Modify: `nichesurage/src/app/discover/longform/page.tsx`

Same changes as Task 3, adapted for longform (different defaults, different contentType guard, different heading).

---

- [ ] **Step 1: Replace longform page content**

Replace the entire content of `nichesurage/src/app/discover/longform/page.tsx` with:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SearchFilters } from '@/components/search/SearchFilters'
import { NicheCard } from '@/components/niche/NicheCard'
import { NicheCardSkeleton } from '@/components/niche/NicheCardSkeleton'
import { fetchNiches } from '@/lib/supabase/queries'
import { filtersToParams, paramsToFilters } from '@/lib/supabase/filterParams'
import { useUser } from '@/lib/context/UserContext'
import type { SearchFilters as SearchFiltersType, NicheCardData } from '@/lib/types'

const LONGFORM_DEFAULTS = { subscriberMin: 1000, subscriberMax: 500000 }

export default function LongformDiscoverPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { tier: userTier, loading: userLoading } = useUser()

  const [filters, setFilters] = useState<SearchFiltersType>(() =>
    paramsToFilters(searchParams, 'longform', LONGFORM_DEFAULTS)
  )
  const [results, setResults] = useState<NicheCardData[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch(filtersOverride?: SearchFiltersType) {
    const f = filtersOverride ?? filters
    setLoading(true)
    setSearched(true)
    setError(null)
    const { data, error: fetchError } = await fetchNiches(f)
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
    if (!userLoading && searchParams.size > 0) {
      handleSearch(paramsToFilters(searchParams, 'longform', LONGFORM_DEFAULTS))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading])

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
          onClick={() => handleSearch()}
          disabled={loading || userLoading}
          className="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          {loading ? 'Searching…' : 'Search Niches'}
        </button>
        {error && (
          <p className="mt-3 text-red-400 text-sm text-center">{error}</p>
        )}
      </div>

      {(userLoading || loading) && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <NicheCardSkeleton key={i} />)}
        </div>
      )}

      {!userLoading && !loading && searched && results.length === 0 && !error && (
        <p className="text-slate-500 text-center py-12">No niches found for these filters.</p>
      )}

      {!userLoading && !loading && results.length > 0 && (
        <div className="flex flex-col gap-3">
          {results.map((niche, i) => (
            <NicheCard key={niche.id} data={niche} userTier={userTier} rank={i + 1} />
          ))}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd nichesurage && npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add nichesurage/src/app/discover/longform/page.tsx
git commit -m "feat: wire real user tier in longform discover page"
```
