# Auth & Discover Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google OAuth login, create an `/auth/callback` route that upserts the user, extend `UserContext` with the `user` field, consolidate `/discover/shorts` + `/discover/longform` into a single `/discover?type=` page, and update all landing-page CTAs.

**Architecture:** Google OAuth is the only auth method — handled via Supabase `signInWithOAuth`. The callback route exchanges the code for a session and inserts the user into `public.users` (idempotent). The unified `/discover` page reads `?type=shorts|longform` from the URL and uses the existing `filterParams.ts` utilities unchanged; the old sub-routes become permanent server-side redirects.

**Tech Stack:** Next.js 14 App Router, Supabase SSR (`@supabase/ssr`), TypeScript, Tailwind CSS, Jest + React Testing Library

---

## File Map

| Action   | Path |
|----------|------|
| Modify   | `src/middleware.ts` |
| Modify   | `src/lib/context/UserContext.tsx` |
| Modify   | `src/lib/context/UserContext.test.tsx` |
| Create   | `src/app/login/page.tsx` |
| Create   | `src/app/auth/callback/route.ts` |
| Create   | `src/app/discover/page.tsx` |
| Replace  | `src/app/discover/shorts/page.tsx` (→ redirect) |
| Replace  | `src/app/discover/longform/page.tsx` (→ redirect) |
| Modify   | `src/app/page.tsx` |

---

## Task 1: Fix middleware redirect target

**Files:**
- Modify: `src/middleware.ts:35`

The middleware currently redirects logged-in users away from `/login` to `/dashboard`, which does not exist. Change the target to `/discover`.

- [ ] **Step 1: Open `src/middleware.ts` and locate line 35**

Current content of the relevant block (lines 34–36):
```typescript
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
```

- [ ] **Step 2: Replace `/dashboard` with `/discover`**

```typescript
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/discover', request.url))
  }
```

Also remove the now-unused `isDashboardRoute` variable (lines 28–29) and the guard that uses it (lines 30–32), since `/discover` is publicly accessible (no login required):

```typescript
// DELETE these lines:
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard')

  if (!user && isDashboardRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
```

Full final `src/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup')

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/discover', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd nichesurage && npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 4: Commit**

```bash
git add nichesurage/src/middleware.ts
git commit -m "fix: redirect logged-in users from /login to /discover (not /dashboard)"
```

---

## Task 2: Extend UserContext with `user` field

**Files:**
- Modify: `src/lib/context/UserContext.tsx`
- Modify: `src/lib/context/UserContext.test.tsx`

Add `user: { id: string; email: string } | null` to the context so components can tell whether the visitor is logged in without making an extra Supabase call.

- [ ] **Step 1: Update `UserContext.tsx` — interface, state, and provider value**

Full replacement of `src/lib/context/UserContext.tsx`:

```typescript
'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserTier } from '@/lib/types/database'

interface UserContextValue {
  user: { id: string; email: string } | null
  tier: UserTier
  loading: boolean
}

const UserContext = createContext<UserContextValue | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [tier, setTier] = useState<UserTier>('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function fetchUser() {
      try {
        const { data: { user: authUser }, error } = await supabase.auth.getUser()
        if (error || !authUser) return
        setUser({ id: authUser.id, email: authUser.email ?? '' })
        const { data, error: dbError } = await supabase
          .from('users')
          .select('tier')
          .eq('id', authUser.id)
          .single()
        if (dbError && process.env.NODE_ENV !== 'production') {
          console.error('[UserContext] DB error fetching tier:', dbError)
        }
        if (data?.tier) {
          setTier(data.tier as UserTier)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [])

  return (
    <UserContext.Provider value={{ user, tier, loading }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (process.env.NODE_ENV !== 'production' && ctx === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return ctx as UserContextValue
}
```

- [ ] **Step 2: Run existing tests to verify they still pass**

```bash
cd nichesurage && npx jest src/lib/context/UserContext.test.tsx --no-coverage
```

Expected: 4 tests pass. They will fail because the mock user object is missing `email`. Note the failures — you will fix them next.

- [ ] **Step 3: Update `UserContext.test.tsx` — add `email` to mock user and add `user` field assertions**

Full replacement of `src/lib/context/UserContext.test.tsx`:

```typescript
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { UserProvider, useUser } from './UserContext'

jest.mock('@/lib/supabase/client')

import { createClient } from '@/lib/supabase/client'

const mockCreateClient = createClient as jest.Mock

function makeSupabaseMock({
  user = null as { id: string; email: string } | null,
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

  it('returns user object, tier:"basic" and loading:false for a logged-in basic user', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabaseMock({ user: { id: 'user-1', email: 'basic@example.com' }, dbTier: 'basic' })
    )
    const { result } = renderHook(() => useUser(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tier).toBe('basic')
    expect(result.current.user).toEqual({ id: 'user-1', email: 'basic@example.com' })
  })

  it('returns user object, tier:"premium" and loading:false for a logged-in premium user', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabaseMock({ user: { id: 'user-2', email: 'premium@example.com' }, dbTier: 'premium' })
    )
    const { result } = renderHook(() => useUser(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tier).toBe('premium')
    expect(result.current.user).toEqual({ id: 'user-2', email: 'premium@example.com' })
  })

  it('returns user:null, tier:"free" and loading:false for an unauthenticated user', async () => {
    mockCreateClient.mockReturnValue(makeSupabaseMock({ user: null }))
    const { result } = renderHook(() => useUser(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tier).toBe('free')
    expect(result.current.user).toBeNull()
  })

  it('returns user:null, tier:"free" and loading:false when getUser returns an error', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabaseMock({ getUserError: new Error('network error') })
    )
    const { result } = renderHook(() => useUser(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tier).toBe('free')
    expect(result.current.user).toBeNull()
  })
})
```

- [ ] **Step 4: Run tests again — must pass**

```bash
cd nichesurage && npx jest src/lib/context/UserContext.test.tsx --no-coverage
```

Expected: 4 tests pass, 0 failures.

- [ ] **Step 5: TypeScript check**

```bash
cd nichesurage && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add nichesurage/src/lib/context/UserContext.tsx nichesurage/src/lib/context/UserContext.test.tsx
git commit -m "feat: extend UserContext with user field (id + email)"
```

---

## Task 3: Create `/login` page

**Files:**
- Create: `src/app/login/page.tsx`

A minimal, premium dark-themed login page with a single "Continue with Google" button. No email/password form.

- [ ] **Step 1: Create `src/app/login/page.tsx`**

```typescript
'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  async function handleGoogleLogin() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 w-full max-w-sm text-center">
        <div className="text-2xl font-extrabold tracking-tight text-white mb-8">
          Niche<span className="text-indigo-400">Surge</span>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Welcome to NicheSurge</h1>
        <p className="text-slate-400 text-sm mb-8">
          Sign in to discover viral YouTube niches
        </p>
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          <GoogleIcon />
          Continue with Google
        </button>
        <p className="text-slate-600 text-xs mt-5">No credit card required</p>
      </div>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.3 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9L37.2 10C33.9 7 29.2 5 24 5 12.9 5 4 13.9 4 25s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.2-2.7-.1-5z"/>
      <path fill="#FF3D00" d="M6.3 15.5l6.6 4.8C14.5 17 19 14 24 14c3 0 5.7 1.1 7.8 2.9L37.2 10C33.9 7 29.2 5 24 5c-7.5 0-14 4.1-17.7 10.5z"/>
      <path fill="#4CAF50" d="M24 45c5.2 0 9.8-1.9 13.3-5l-6.2-5.2C29.2 36.6 26.7 37.5 24 37.5c-5.3 0-9.6-3.7-11.2-8.7L6.2 34C9.8 40.1 16.4 45 24 45z"/>
      <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.5-2.4 4.6-4.5 6l6.2 5.2C41 35.8 44 30.8 44 25c0-1.3-.2-2.7-.4-5z"/>
    </svg>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd nichesurage && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add nichesurage/src/app/login/page.tsx
git commit -m "feat: add /login page with Google OAuth button"
```

---

## Task 4: Create `/auth/callback` route

**Files:**
- Create: `src/app/auth/callback/route.ts`

Server route that exchanges the OAuth code for a session, inserts the user into `public.users` (with `tier: 'free'`) if they don't exist yet, then redirects to `/discover`.

- [ ] **Step 1: Create `src/app/auth/callback/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('users')
          .upsert(
            { id: user.id, email: user.email ?? '', tier: 'free' },
            { onConflict: 'id', ignoreDuplicates: true }
          )
      }
      return NextResponse.redirect(`${origin}/discover`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
```

`ignoreDuplicates: true` means: if a row with this `id` already exists, do nothing (don't overwrite `tier`). This makes the callback idempotent — safe to call multiple times.

- [ ] **Step 2: TypeScript check**

```bash
cd nichesurage && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add nichesurage/src/app/auth/callback/route.ts
git commit -m "feat: add /auth/callback route — exchange code, upsert user, redirect to /discover"
```

---

## Task 5: Create unified `/discover` page

**Files:**
- Create: `src/app/discover/page.tsx`

Replaces the two separate shorts/longform pages. Reads `?type=shorts` (default) or `?type=longform` from the URL. ContentType toggle updates the URL via `router.replace` without a hard reload.

Key decisions:
- `filtersToParams` (existing, unchanged) does NOT include `contentType` — we append `type` manually.
- `paramsToFilters` (existing, unchanged) takes `contentType` as an explicit argument — we derive it from `?type=`.
- Defaults differ by content type: shorts use `subscriberMax: 100000`, longform use `subscriberMax: 500000`.

- [ ] **Step 1: Create `src/app/discover/page.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SearchFilters } from '@/components/search/SearchFilters'
import { NicheCard } from '@/components/niche/NicheCard'
import { NicheCardSkeleton } from '@/components/niche/NicheCardSkeleton'
import { fetchNiches } from '@/lib/supabase/queries'
import { filtersToParams, paramsToFilters, type ReadableParams } from '@/lib/supabase/filterParams'
import { useUser } from '@/lib/context/UserContext'
import type { SearchFilters as SearchFiltersType, NicheCardData, ContentType } from '@/lib/types'

const DEFAULTS: Record<ContentType, { subscriberMin: number; subscriberMax: number }> = {
  shorts: { subscriberMin: 1000, subscriberMax: 100000 },
  longform: { subscriberMin: 1000, subscriberMax: 500000 },
}

const HEADINGS: Record<ContentType, { icon: string; title: string; sub: string }> = {
  shorts: {
    icon: '🎬',
    title: 'Shorts Niche Discovery',
    sub: 'Find viral Shorts niches. Set your filters and search.',
  },
  longform: {
    icon: '🎥',
    title: 'Longform Niche Discovery',
    sub: 'Find high-potential Longform niches. Set your filters and search.',
  },
}

function resolveContentType(params: ReadableParams): ContentType {
  return params.get('type') === 'longform' ? 'longform' : 'shorts'
}

export default function DiscoverPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { tier: userTier, loading: userLoading } = useUser()

  const contentType = resolveContentType(searchParams)

  const [filters, setFilters] = useState<SearchFiltersType>(() =>
    paramsToFilters(searchParams, contentType, DEFAULTS[contentType])
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
    const params = filtersToParams(updated)
    params.set('type', updated.contentType)
    router.replace(`/discover?${params}`)
    setFilters(updated)
  }

  useEffect(() => {
    if (!userLoading && searchParams.size > 0) {
      const ct = resolveContentType(searchParams)
      const f = paramsToFilters(searchParams, ct, DEFAULTS[ct])
      setFilters(f)
      handleSearch(f)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading])

  const { icon, title, sub } = HEADINGS[contentType]

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">
        {icon} {title}
      </h1>
      <p className="text-slate-400 text-sm mb-6">{sub}</p>

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

- [ ] **Step 2: TypeScript check**

```bash
cd nichesurage && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add nichesurage/src/app/discover/page.tsx
git commit -m "feat: add unified /discover page with ?type=shorts|longform support"
```

---

## Task 6: Replace `/discover/shorts` and `/discover/longform` with server redirects

**Files:**
- Replace: `src/app/discover/shorts/page.tsx`
- Replace: `src/app/discover/longform/page.tsx`

Both old pages become simple server components that immediately redirect to the unified `/discover` URL with the appropriate `?type=` param. Any old bookmarks or links will land correctly.

- [ ] **Step 1: Replace `src/app/discover/shorts/page.tsx`**

Delete all existing content and write:

```typescript
import { redirect } from 'next/navigation'

export default function ShortsRedirect() {
  redirect('/discover?type=shorts')
}
```

- [ ] **Step 2: Replace `src/app/discover/longform/page.tsx`**

Delete all existing content and write:

```typescript
import { redirect } from 'next/navigation'

export default function LongformRedirect() {
  redirect('/discover?type=longform')
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd nichesurage && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
cd nichesurage && npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add nichesurage/src/app/discover/shorts/page.tsx nichesurage/src/app/discover/longform/page.tsx
git commit -m "feat: redirect /discover/shorts and /discover/longform to unified /discover page"
```

---

## Task 7: Update landing page CTAs

**Files:**
- Modify: `src/app/page.tsx`

Per the spec FOMO pattern:
- "Start Free" / "Start Discovering" / "Get Started Free" → `/discover` (public, no login required — shows blurred data as teaser)
- "Get Basic" / "Get Premium" → `/login` (billing tier CTAs require sign-in)
- Footer links → `/discover?type=shorts` and `/discover?type=longform`
- Nav "Discover" link → `/discover`

- [ ] **Step 1: Update `src/app/page.tsx` — change all `/discover/shorts` and `/discover/longform` references**

Find every `href="/discover/shorts"` and `href="/discover/longform"` and replace as follows:

| Location | Old href | New href |
|----------|----------|----------|
| Nav "Discover" link (line 34) | `/discover/shorts` | `/discover` |
| Nav "Start Free" button (line 38) | `/discover/shorts` | `/discover` |
| Hero "Start Discovering — Free" (line 71) | `/discover/shorts` | `/discover` |
| Pricing Free "Get Started Free" (line 176) | `/discover/shorts` | `/discover` |
| Pricing Basic "Get Basic" (line 207) | `/discover/shorts` | `/login` |
| Pricing Premium "Get Premium" (line 248) | `/discover/shorts` | `/login` |
| Bottom CTA "Start Discovering — Free" (line 269) | `/discover/shorts` | `/discover` |
| Footer "Shorts" (line 285) | `/discover/shorts` | `/discover?type=shorts` |
| Footer "Longform" (line 286) | `/discover/longform` | `/discover?type=longform` |

Make each replacement precisely. The file is `src/app/page.tsx`.

- [ ] **Step 2: TypeScript check**

```bash
cd nichesurage && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
cd nichesurage && npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add nichesurage/src/app/page.tsx
git commit -m "feat: update landing page CTAs — free CTAs to /discover, paid CTAs to /login"
```

---

## Manual Verification Checklist

After all tasks are complete, verify these flows in the browser (dev server running on `localhost:3000`):

- [ ] `/` — Landing page loads; "Start Free" and "Start Discovering" go to `/discover`; "Get Basic" and "Get Premium" go to `/login`; footer "Shorts" → `/discover?type=shorts`, "Longform" → `/discover?type=longform`
- [ ] `/login` — Dark card with NicheSurge logo and "Continue with Google" button; clicking starts OAuth (only works after configuring Google OAuth in Supabase dashboard)
- [ ] `/discover` — Shorts discovery page loads by default; ContentType toggle switches to `?type=longform` in URL without reload; filter params appear in URL
- [ ] `/discover?type=longform` — Longform page loads directly from URL
- [ ] `/discover/shorts` — Redirects to `/discover?type=shorts`
- [ ] `/discover/longform` — Redirects to `/discover?type=longform`
- [ ] When logged in, visiting `/login` — Redirects to `/discover`
