# Free-Tier Paywall Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the revenue-affecting bug where FREE users see up to 12 different unlocked niches per day (3 tabs × 4 6h windows). After this plan, FREE users see exactly 1 globally-pinned niche/day across all tabs, anon and logged-in, with a daily login modal for returning users and AI features hard-locked to the genuine first-login WOW flow.

**Architecture:** Reuse the existing race-safe `daily_demo_niche` table (Sprint A.9). Replace per-user 6h hash-windowed reveal with the globally-pinned `scan_result_id` for the FREE tier. Add a one-shot-per-UTC-day login modal driven by a new 1st-party cookie. Narrow the AI bypass server-side so it only triggers on legitimate first-login traffic (URL param + cookie + scan match), not on the daily-modal return path.

**Tech Stack:** Next.js 14 (App Router, client + Node API routes), TypeScript, Supabase (service-role for `daily_demo_niche` insert), Jest + React Testing Library. No new dependencies. No new migrations — `daily_demo_niche` already exists.

**Spec reference:** [docs/superpowers/specs/2026-05-22-free-tier-paywall-design.md](../specs/2026-05-22-free-tier-paywall-design.md) (the approved brainstorm doc lives at `~/.claude/plans/evo-transient-spark.md` and will be copied into specs/ during execution Task 0).

**Branch:** `fix/free-tier-paywall` (worktree off `origin/master` @ `06d1dbe`). Execution skill creates the worktree.

---

## File Structure

**Created:**
- `nichesurage/src/lib/demo/dailyModalCookie.ts` — pure cookie helpers (read seen-key, format expiry, write). No React, no I/O outside `document.cookie`.
- `nichesurage/src/lib/demo/dailyModalCookie.test.ts` — unit tests for cookie helpers.
- `nichesurage/src/lib/demo/useDailyFreeModal.ts` — client hook: given current free user + today's pin, decides whether to auto-open the modal. Separate from `useFreeDemoState` (different concern: returning-user trigger vs. first-login validation).
- `nichesurage/src/lib/demo/useDailyFreeModal.test.tsx` — RTL test for the hook.
- `nichesurage/src/components/niche/DailyFreeModal.tsx` — read-only niche detail modal for returning FREE users. Reuses `NicheDetailModal` shell; embeds `NicheDetailContent` with `tier='free'` (so AI sections render their locked teaser as on any other niche). No banner, no bypass.
- `nichesurage/src/components/niche/DailyFreeModal.test.tsx` — RTL test for open/close/cookie-set.

**Modified:**
- `nichesurage/src/lib/tier/reveal.ts` — `getRevealedIds()` gains a `todayPinId: string | null` parameter; FREE branch returns `todayPinId ? new Set([todayPinId]) : new Set()`. `getNextRevealAt`/`getMsUntilNextReveal` for FREE switch from the 6h window to next UTC midnight. The old `getFreeRevealedIndex` is **removed** (last consumer leaves with this PR).
- `nichesurage/src/lib/tier/reveal.test.ts` — drop 6h-window tests; add pin-based tests + UTC-midnight rotation tests.
- `nichesurage/src/lib/tier/visibleResults.ts` — `computeVisibleResults` gains `todayPinId: string | null`. FREE branch returns `[top 4 by score, pinRow]`, where `pinRow` is the row in `results` whose `id === todayPinId` (or just `top 4` if pin isn't in fetched set).
- `nichesurage/src/lib/tier/visibleResults.test.ts` — add pin-based tests, drop 6h tests.
- `nichesurage/src/components/niche/RevealCountdown.tsx` — for FREE, label reads "Next reveal: tomorrow {UTC midnight in user TZ}" derived from updated `getNextRevealAt`.
- `nichesurage/src/app/api/demo/today/route.ts` — replace the read-only SELECT with `getDailyDemoNiche(createServiceClient())` so the route ensures today's pin via race-safe upsert. Anon visitor traffic on a cold UTC day still gets a populated answer instead of `null`. Same cache headers preserved.
- `nichesurage/src/app/api/demo/today/route.test.ts` — assert `getDailyDemoNiche` invoked, assert response shape unchanged.
- `nichesurage/src/app/discover/page.tsx` — fetch today's pin via `/api/demo/today` on mount; thread `todayPinId` into `getRevealedIds` + `computeVisibleResults`; render `DailyFreeModal` when the daily-modal hook says so. Drop the per-tab varying-reveal symptom by passing the same pin to every surface.
- `nichesurage/src/components/niche/NicheDetailContent.tsx` — pass a new `isLegitimateDemo: boolean` prop (derived from `useFreeDemoState() === 'legitimate'`) into the AI children so they can sign their fetch request.
- `nichesurage/src/components/niche/HealthCheckInline.tsx` — accept `isLegitimateDemo?: boolean`; if true, append `?demo=1` to the fetch URL.
- `nichesurage/src/components/niche/HealthCheckModal.tsx` — same.
- `nichesurage/src/components/niche/AIContentAngles.tsx` — same.
- `nichesurage/src/app/api/health-check/[id]/route.ts` — `isTodaysDemoNiche` now requires three signals: `Request` query `demo=1`, `surgeniche_demo_seen` cookie, AND scan_id match. Without all three → no bypass → free tier → tier check returns 403.
- `nichesurage/src/app/api/health-check/[id]/route.test.ts` — add tests for "free returning user without `?demo=1` → 403"; "first-login signal → 200 cached".
- `nichesurage/src/app/api/content-angles/[id]/route.ts` — identical narrowing.
- `nichesurage/src/app/api/content-angles/[id]/route.test.ts` — identical test additions.

**Not touching:**
- `nichesurage/src/app/auth/callback/route.ts` — the first-login redirect + `surgeniche_demo_seen` cookie + `getDailyDemoNiche` call already work correctly. No edit.
- `nichesurage/src/lib/demo/preWarm.ts` — first-login WOW pre-warm is unrelated. No edit.
- `nichesurage/src/lib/demo/useFreeDemoState.ts` — keeps its three states (`'pending' | 'legitimate' | 'not-demo'`). Daily-modal logic is a separate hook (`useDailyFreeModal`) so the two state machines don't drift.

---

## Conventions enforced for every task

From [`nichesurage/CLAUDE.md`](../../../nichesurage/CLAUDE.md):

- **Per-phase gate:** every commit-step must be preceded by `npx tsc --noEmit` (in `nichesurage/`) + `npm test -- --runInBand` (whole suite or the file-scoped subset listed in the task). Green before commit. Red → fix-forward in the same task, do not commit broken state.
- **Focused `git add`:** add named files explicitly. Never `git add -A` or `git add .`.
- **Iterators:** use `Array.from(...)` not `[...iter]` (tsconfig `downlevelIteration: false`).
- **PowerShell:** if the executor is on Windows + PowerShell, `git commit -m` heredocs fail. Use `@'...'@` literal here-string or `git commit -F file.txt`.
- **Windows TLS:** if `npm install` is needed, prefix with `$env:NODE_OPTIONS="--use-system-ca"` (PowerShell) or `NODE_OPTIONS=--use-system-ca npm install` (bash).
- **No `git add -A`. No `--no-verify`. No amend of pushed commits.**

---

### Task 0: Copy approved spec into the repo

**Files:**
- Copy from `C:\Users\AURUMPC\.claude\plans\evo-transient-spark.md`
- Create: `docs/superpowers/specs/2026-05-22-free-tier-paywall-design.md`

- [ ] **Step 1: Copy the file**

PowerShell:

```powershell
Copy-Item "$env:USERPROFILE\.claude\plans\evo-transient-spark.md" "docs/superpowers/specs/2026-05-22-free-tier-paywall-design.md"
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-05-22-free-tier-paywall-design.md
git commit -m "docs: free-tier paywall design spec"
```

---

### Task 1: Cookie helper module

**Files:**
- Create: `nichesurage/src/lib/demo/dailyModalCookie.ts`
- Test: `nichesurage/src/lib/demo/dailyModalCookie.test.ts`

The helper has three responsibilities:
1. `getDailyModalSeenKey(now: Date)` — returns the UTC date string (`YYYY-MM-DD`) the cookie value compares against.
2. `hasSeenDailyModal(cookieString, now)` — pure function over `document.cookie` content + a date; returns `true` if `sn_daily_modal_seen=<today>` is present.
3. `markDailyModalSeen(now)` — sets `document.cookie` with `Expires=` next UTC midnight, `Path=/`, `SameSite=Lax`.

Keeping helpers pure (with `document.cookie` access isolated to one function) makes them testable without jsdom cookie shenanigans for two of three functions.

- [ ] **Step 1: Write the failing test**

`nichesurage/src/lib/demo/dailyModalCookie.test.ts`:

```ts
/** @jest-environment jsdom */

import {
  getDailyModalSeenKey,
  hasSeenDailyModal,
  markDailyModalSeen,
  nextUtcMidnight,
} from './dailyModalCookie'

describe('dailyModalCookie', () => {
  describe('getDailyModalSeenKey', () => {
    it('returns the UTC date as YYYY-MM-DD', () => {
      const d = new Date(Date.UTC(2026, 4, 22, 14, 30, 0))
      expect(getDailyModalSeenKey(d)).toBe('2026-05-22')
    })

    it('rolls over at UTC midnight, not local midnight', () => {
      // 23:59 UTC on 2026-05-22 is still 2026-05-22 regardless of TZ
      const beforeMidnight = new Date(Date.UTC(2026, 4, 22, 23, 59, 0))
      expect(getDailyModalSeenKey(beforeMidnight)).toBe('2026-05-22')

      const afterMidnight = new Date(Date.UTC(2026, 4, 23, 0, 0, 1))
      expect(getDailyModalSeenKey(afterMidnight)).toBe('2026-05-23')
    })
  })

  describe('nextUtcMidnight', () => {
    it('returns the next 00:00:00.000 UTC after `now`', () => {
      const now = new Date(Date.UTC(2026, 4, 22, 14, 30, 0))
      const next = nextUtcMidnight(now)
      expect(next.toISOString()).toBe('2026-05-23T00:00:00.000Z')
    })

    it('returns the next day at midnight even when `now` is exactly midnight', () => {
      // Don't let the function return `now` itself — that would zero MaxAge.
      const now = new Date(Date.UTC(2026, 4, 22, 0, 0, 0))
      const next = nextUtcMidnight(now)
      expect(next.toISOString()).toBe('2026-05-23T00:00:00.000Z')
    })
  })

  describe('hasSeenDailyModal', () => {
    it('returns true when cookie matches today', () => {
      const now = new Date(Date.UTC(2026, 4, 22, 12, 0, 0))
      expect(
        hasSeenDailyModal('other=1; sn_daily_modal_seen=2026-05-22; foo=bar', now),
      ).toBe(true)
    })

    it('returns false when cookie value is a previous day', () => {
      const now = new Date(Date.UTC(2026, 4, 22, 12, 0, 0))
      expect(
        hasSeenDailyModal('sn_daily_modal_seen=2026-05-21', now),
      ).toBe(false)
    })

    it('returns false when cookie missing', () => {
      const now = new Date(Date.UTC(2026, 4, 22, 12, 0, 0))
      expect(hasSeenDailyModal('other=1', now)).toBe(false)
      expect(hasSeenDailyModal('', now)).toBe(false)
    })
  })

  describe('markDailyModalSeen', () => {
    afterEach(() => {
      // Clear cookies between tests so jsdom state doesn't leak.
      document.cookie = 'sn_daily_modal_seen=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
    })

    it('writes the today key to document.cookie', () => {
      const now = new Date(Date.UTC(2026, 4, 22, 12, 0, 0))
      markDailyModalSeen(now)
      expect(document.cookie).toContain('sn_daily_modal_seen=2026-05-22')
    })
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

```powershell
cd nichesurage
npx jest src/lib/demo/dailyModalCookie.test.ts
```

Expected: FAIL — `Cannot find module './dailyModalCookie'`.

- [ ] **Step 3: Implement the helper**

`nichesurage/src/lib/demo/dailyModalCookie.ts`:

```ts
// Daily-free-modal cookie helpers.
//
// The modal opens once per UTC day per device for returning FREE users.
// We use a 1st-party cookie (immune to Safari ITP since it never leaves
// the apex domain) and an `Expires=` set to next UTC midnight so a user
// in any TZ sees a fresh modal at the same instant we rotate the pin.

export const DAILY_MODAL_COOKIE_NAME = 'sn_daily_modal_seen'

/** UTC date as YYYY-MM-DD; the cookie value matches this format. */
export function getDailyModalSeenKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Next 00:00:00.000 UTC strictly AFTER `now`. When `now` is exactly
 * midnight we still return the next day so the cookie has positive
 * lifetime (a 0-MaxAge cookie would be immediately discarded).
 */
export function nextUtcMidnight(now: Date): Date {
  const d = new Date(now)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + 1)
  return d
}

/** Pure check against a cookie string. Caller passes `document.cookie`. */
export function hasSeenDailyModal(cookieString: string, now: Date): boolean {
  const key = getDailyModalSeenKey(now)
  const target = `${DAILY_MODAL_COOKIE_NAME}=${key}`
  return cookieString
    .split(';')
    .some((c) => c.trim() === target)
}

/** Side-effecting writer. Browser only; calling this in Node throws. */
export function markDailyModalSeen(now: Date): void {
  const expires = nextUtcMidnight(now).toUTCString()
  const value = getDailyModalSeenKey(now)
  document.cookie = `${DAILY_MODAL_COOKIE_NAME}=${value}; expires=${expires}; path=/; SameSite=Lax`
}
```

- [ ] **Step 4: Run test, verify it passes**

```powershell
npx jest src/lib/demo/dailyModalCookie.test.ts
```

Expected: PASS, all 8 assertions green.

- [ ] **Step 5: Whole-project guard**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add nichesurage/src/lib/demo/dailyModalCookie.ts nichesurage/src/lib/demo/dailyModalCookie.test.ts
git commit -m "feat(free-tier): cookie helpers for daily modal seen-state"
```

---

### Task 2: `reveal.ts` — accept `todayPinId`, drop 6h rotation for FREE

**Files:**
- Modify: `nichesurage/src/lib/tier/reveal.ts`
- Modify: `nichesurage/src/lib/tier/reveal.test.ts`

Three changes:
1. `getRevealedIds()` signature gains `todayPinId: string | null` (positional, after `userId` so existing call sites can be migrated in one place). FREE branch returns `todayPinId ? new Set([todayPinId]) : new Set()`. The `userId` + `now` args become unused for FREE but stay on the signature for symmetry (Basic still ignores them; Premium ignores them — no API churn for non-free callers).
2. `getNextRevealAt(tier, now)` for FREE returns next UTC midnight (uses the same `nextUtcMidnight` from Task 1). Basic/Premium still return `null`.
3. `getFreeRevealedIndex` and `FREE_WINDOW_MS` are **removed**. `getFreeRevealedIndex` was the per-user-hash 6h picker; its only remaining consumer (`computeVisibleResults`) is updated in Task 3 to use `todayPinId` instead.

`hashStringToInt`, `BASIC_VISIBLE_COUNT`, `FREE_REVEAL_RANGE_START`, `FREE_REVEAL_RANGE_END` — keep `BASIC_VISIBLE_COUNT` (still used). Delete `hashStringToInt`, `FREE_REVEAL_RANGE_END`, `FREE_REVEAL_RANGE_START` if no remaining consumers (run grep before deleting).

- [ ] **Step 1: Audit consumers of the deleted helpers**

```powershell
cd c:\Users\AURUMPC\Desktop\YT-app
```

```bash
git grep -n "getFreeRevealedIndex\|hashStringToInt\|FREE_WINDOW_MS\|FREE_REVEAL_RANGE_START\|FREE_REVEAL_RANGE_END" -- 'nichesurage/src'
```

Expected: matches only in `nichesurage/src/lib/tier/reveal.ts`, `nichesurage/src/lib/tier/reveal.test.ts`, `nichesurage/src/lib/tier/visibleResults.ts`, `nichesurage/src/lib/tier/visibleResults.test.ts`. If anything outside `tier/` matches → reconcile before deleting.

The plan removes these symbols outright in this task. The downstream consumer (`visibleResults.ts`) will go red on TS — that is expected and gets fixed in Task 3 (which is why Tasks 2, 3, 4, 8 commit together at the end of Task 8).

- [ ] **Step 2: Write failing tests for the new signature**

Replace `nichesurage/src/lib/tier/reveal.test.ts` with (file is currently mostly 6h-window tests):

```ts
import {
  BASIC_VISIBLE_COUNT,
  getNextRevealAt,
  getMsUntilNextReveal,
  getRevealedIds,
} from './reveal'

describe('getRevealedIds', () => {
  const niches = ['n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6']
  const userId = 'user-abc'
  const now = new Date('2026-05-22T14:00:00Z')

  it('premium returns the full set', () => {
    const out = getRevealedIds('premium', niches, userId, now, 'n3')
    expect(out).toEqual(new Set(niches))
  })

  it('basic returns the top BASIC_VISIBLE_COUNT regardless of pin', () => {
    const out = getRevealedIds('basic', niches, userId, now, 'n6')
    expect(out).toEqual(new Set(niches.slice(0, BASIC_VISIBLE_COUNT)))
    expect(out.size).toBe(BASIC_VISIBLE_COUNT)
  })

  it('free returns ONLY the pin when pin is provided', () => {
    const out = getRevealedIds('free', niches, userId, now, 'n3')
    expect(out).toEqual(new Set(['n3']))
  })

  it('free returns empty set when pin is null (no pin yet today)', () => {
    const out = getRevealedIds('free', niches, userId, now, null)
    expect(out).toEqual(new Set())
  })

  it('free returns empty set when pin id is not in the fetched results', () => {
    // The pin is a real DB row, but the current discover surface filter
    // excluded it (e.g. category filter). We should NOT unlock a row that
    // isn't even in the visible list — caller renders empty state.
    const out = getRevealedIds('free', niches, userId, now, 'not-in-list')
    expect(out).toEqual(new Set())
  })

  it('free for the same pin is identical across two different user IDs', () => {
    const a = getRevealedIds('free', niches, 'user-a', now, 'n3')
    const b = getRevealedIds('free', niches, 'user-b', now, 'n3')
    expect(a).toEqual(b)
  })

  it('free for the same pin is identical across two different surfaces / sorts', () => {
    // Different tab sorts pass different `niches` orderings but the same
    // pin id. The pin must still be unlocked (set membership test).
    const sortedA = ['n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6']
    const sortedB = ['n6', 'n4', 'n3', 'n1', 'n2', 'n0', 'n5']
    expect(getRevealedIds('free', sortedA, userId, now, 'n3')).toEqual(new Set(['n3']))
    expect(getRevealedIds('free', sortedB, userId, now, 'n3')).toEqual(new Set(['n3']))
  })
})

describe('getNextRevealAt', () => {
  it('returns next UTC midnight for free tier', () => {
    const now = new Date('2026-05-22T14:30:00Z')
    const at = getNextRevealAt('free', now)
    expect(at?.toISOString()).toBe('2026-05-23T00:00:00.000Z')
  })

  it('returns null for basic', () => {
    expect(getNextRevealAt('basic', new Date())).toBeNull()
  })

  it('returns null for premium', () => {
    expect(getNextRevealAt('premium', new Date())).toBeNull()
  })
})

describe('getMsUntilNextReveal', () => {
  it('returns positive ms for free', () => {
    const now = new Date('2026-05-22T23:30:00Z')
    const ms = getMsUntilNextReveal('free', now)
    expect(ms).not.toBeNull()
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThanOrEqual(30 * 60 * 1000) // ≤30 min
  })

  it('returns null for basic / premium', () => {
    expect(getMsUntilNextReveal('basic', new Date())).toBeNull()
    expect(getMsUntilNextReveal('premium', new Date())).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests, verify they fail**

```powershell
cd nichesurage
npx jest src/lib/tier/reveal.test.ts
```

Expected: FAIL — signature mismatch (5 args vs current 4), missing UTC-midnight behavior.

- [ ] **Step 4: Rewrite `reveal.ts`**

Replace the existing file body with:

```ts
import type { UserTier } from '@/lib/types/database'
import { nextUtcMidnight } from '@/lib/demo/dailyModalCookie'

// Reveal logic post free-tier paywall fix.
//
// - PREMIUM: every fetched niche is unlocked.
// - BASIC: top BASIC_VISIBLE_COUNT by input order.
// - FREE: exactly ONE niche unlocked — the globally-pinned daily demo
//   from `daily_demo_niche`. Caller fetches the pin id and passes it in.
//   Identical for every free user and across every /discover surface tab,
//   so a user can never see more than 1 unlocked niche per UTC day.
//
// Rotation: next UTC midnight. The 6h hash-window scheme that produced
// up to 4 reveals/day was removed — see the 2026-05-22 paywall plan.

export const BASIC_VISIBLE_COUNT = 5

/**
 * Returns the set of niche IDs currently unlocked for this user/tier.
 *
 * `todayPinId` is the `scan_results.id` returned by `getDailyDemoNiche`
 * (or `/api/demo/today`). Pass `null` if the lookup failed or the pool
 * is cold — FREE will see everything blurred, which is correct.
 *
 * `userId` and `now` are kept on the signature for symmetry but only
 * Premium / Basic ignore them outright; FREE no longer reads either
 * (the pin is global-deterministic, not per-user).
 */
export function getRevealedIds(
  tier: UserTier,
  sortedNicheIds: readonly string[],
  _userId: string,
  _now: Date,
  todayPinId: string | null,
): Set<string> {
  if (tier === 'premium') {
    return new Set(sortedNicheIds)
  }
  if (tier === 'basic') {
    return new Set(sortedNicheIds.slice(0, BASIC_VISIBLE_COUNT))
  }
  // free
  if (!todayPinId) return new Set()
  // The pin must actually be in the fetched results — otherwise we'd
  // mark a row "unlocked" that isn't even rendered. Caller is responsible
  // for fetching the row; here we just verify set membership.
  if (!sortedNicheIds.includes(todayPinId)) return new Set()
  return new Set([todayPinId])
}

/**
 * Next reveal boundary. FREE rotates at next UTC midnight (globally
 * shared with `daily_demo_niche.date` rotation). Basic/Premium return
 * null — no countdown.
 */
export function getNextRevealAt(tier: UserTier, now: Date): Date | null {
  if (tier !== 'free') return null
  return nextUtcMidnight(now)
}

/** Convenience for the UI countdown. */
export function getMsUntilNextReveal(tier: UserTier, now: Date): number | null {
  const at = getNextRevealAt(tier, now)
  if (!at) return null
  return Math.max(0, at.getTime() - now.getTime())
}
```

Notes on what was deleted intentionally:
- `FREE_WINDOW_MS`, `FREE_REVEAL_RANGE_START`, `FREE_REVEAL_RANGE_END`, `hashStringToInt`, `getFreeWindowIndex`, `getFreeRevealedIndex` — no longer needed. Task 3 will remove their use in `visibleResults.ts`.

- [ ] **Step 5: Run tests, verify they pass**

```powershell
npx jest src/lib/tier/reveal.test.ts
```

Expected: PASS, 11 assertions green.

- [ ] **Step 6: TS check (expect a failure in visibleResults — that's Task 3)**

```powershell
npx tsc --noEmit
```

Expected: error in `src/lib/tier/visibleResults.ts` complaining about missing `getFreeRevealedIndex` / `FREE_REVEAL_RANGE_START`, plus the `discover/page.tsx` mismatch on `getRevealedIds` arity. **Do not commit yet.** Proceed to Task 3 to resolve, then commit at end of Task 3 (combined commit because reveal.ts and visibleResults.ts are tightly coupled).

If TS errors appear in any file outside `tier/visibleResults.ts` or `app/discover/page.tsx`, STOP — they will be addressed in Task 9 (discover page) and indicate a missed consumer. List them and update Task 9.

- [ ] **Step 7: Hold the commit**

This task's changes commit together with Task 3 because the type signature for both functions changed and TS must stay green at every commit.

---

### Task 3: `visibleResults.ts` — pin-based FREE slice

**Files:**
- Modify: `nichesurage/src/lib/tier/visibleResults.ts`
- Modify: `nichesurage/src/lib/tier/visibleResults.test.ts`

For FREE, the visible array is `[top 4 by score, pinRow]` where `pinRow` is the row in `results` whose `id === todayPinId`. Edge cases:
- `todayPinId` is null → return `top 4` (all blurred, no reveal).
- Pin id not in `results` (filtered out by category) → return `top 4`.
- Pin id is already in the top 4 → return `top 4` (no duplicate).

- [ ] **Step 1: Read current tests**

```powershell
type src\lib\tier\visibleResults.test.ts
```

Existing tests rely on `getFreeRevealedIndex` — they will be replaced.

- [ ] **Step 2: Write failing tests**

Replace `nichesurage/src/lib/tier/visibleResults.test.ts` with:

```ts
import { computeVisibleResults } from './visibleResults'

interface TestRow {
  id: string
}

function rows(ids: string[]): TestRow[] {
  return ids.map((id) => ({ id }))
}

describe('computeVisibleResults', () => {
  const now = new Date('2026-05-22T14:00:00Z')
  const userId = 'user-abc'

  describe('premium / basic', () => {
    const seven = rows(['a', 'b', 'c', 'd', 'e', 'f', 'g'])

    it('premium returns the first visibleCount rows', () => {
      const out = computeVisibleResults({
        tier: 'premium',
        userId,
        results: seven,
        visibleCount: 3,
        now,
        todayPinId: null,
      })
      expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    })

    it('basic returns the first visibleCount rows', () => {
      const out = computeVisibleResults({
        tier: 'basic',
        userId,
        results: seven,
        visibleCount: 5,
        now,
        todayPinId: null,
      })
      expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
    })
  })

  describe('free', () => {
    const seven = rows(['top0', 'top1', 'top2', 'top3', 'pin', 'extra1', 'extra2'])

    it('returns top 4 + pin when pin is at position ≥4', () => {
      const out = computeVisibleResults({
        tier: 'free',
        userId,
        results: seven,
        visibleCount: 12,
        now,
        todayPinId: 'pin',
      })
      expect(out.map((r) => r.id)).toEqual(['top0', 'top1', 'top2', 'top3', 'pin'])
    })

    it('returns just top 4 when pin is null', () => {
      const out = computeVisibleResults({
        tier: 'free',
        userId,
        results: seven,
        visibleCount: 12,
        now,
        todayPinId: null,
      })
      expect(out.map((r) => r.id)).toEqual(['top0', 'top1', 'top2', 'top3'])
    })

    it('returns just top 4 when pin id is not in results', () => {
      const out = computeVisibleResults({
        tier: 'free',
        userId,
        results: seven,
        visibleCount: 12,
        now,
        todayPinId: 'not-in-list',
      })
      expect(out.map((r) => r.id)).toEqual(['top0', 'top1', 'top2', 'top3'])
    })

    it('returns just top 4 when pin id is already inside the top 4 (no dup)', () => {
      const out = computeVisibleResults({
        tier: 'free',
        userId,
        results: seven,
        visibleCount: 12,
        now,
        todayPinId: 'top2',
      })
      expect(out.map((r) => r.id)).toEqual(['top0', 'top1', 'top2', 'top3'])
    })

    it('returns what we have when pool ≤ 4 even with a pin', () => {
      const three = rows(['a', 'b', 'c'])
      const out = computeVisibleResults({
        tier: 'free',
        userId,
        results: three,
        visibleCount: 12,
        now,
        todayPinId: 'b',
      })
      expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    })
  })
})
```

- [ ] **Step 3: Run tests, verify they fail**

```powershell
npx jest src/lib/tier/visibleResults.test.ts
```

Expected: FAIL — `todayPinId` argument doesn't exist on the existing `ComputeVisibleResultsArgs`.

- [ ] **Step 4: Rewrite `visibleResults.ts`**

```ts
import type { UserTier } from '@/lib/types/database'

// /discover visible-results derivation.
//
// FREE: top 4 by score + the globally-pinned daily niche (1 unlock).
// The pin id comes from `daily_demo_niche` via /api/demo/today; passed
// in by the caller so this stays a pure function.
//
// BASIC / PREMIUM: simple slice(0, visibleCount).

const FREE_TOP_LOCKED = 4

export interface IdBearing {
  readonly id: string
}

export interface ComputeVisibleResultsArgs<T extends IdBearing> {
  tier: UserTier
  userId: string
  results: readonly T[]
  /** Effective for non-free tiers only. */
  visibleCount: number
  now: Date
  /** Today's globally-pinned scan_result_id. Null when no pin yet. */
  todayPinId: string | null
}

export function computeVisibleResults<T extends IdBearing>(
  args: ComputeVisibleResultsArgs<T>,
): readonly T[] {
  const { tier, results, visibleCount, todayPinId } = args
  if (tier !== 'free') {
    return results.slice(0, visibleCount)
  }
  if (results.length <= FREE_TOP_LOCKED) {
    return results.slice(0, results.length)
  }
  const top = results.slice(0, FREE_TOP_LOCKED)
  if (!todayPinId) return top
  // Skip if pin is missing from the fetched surface or already in top 4.
  if (top.some((r) => r.id === todayPinId)) return top
  const pin = results.find((r) => r.id === todayPinId)
  if (!pin) return top
  return [...top, pin]
}
```

- [ ] **Step 5: Run tests, verify they pass**

```powershell
npx jest src/lib/tier/visibleResults.test.ts src/lib/tier/reveal.test.ts
```

Expected: PASS, 17 total assertions across both files.

- [ ] **Step 6: TS check**

```powershell
npx tsc --noEmit
```

Expected: errors remaining only in:
- `src/app/discover/page.tsx` — call sites for `getRevealedIds` (missing arg) and `computeVisibleResults` (missing prop).
- `src/components/niche/RevealCountdown.tsx` — uses removed `getNextRevealAt` 6h logic indirectly; signature unchanged so this should still compile. Verify it does.

If `RevealCountdown.tsx` compiles, leave the `discover/page.tsx` errors for Task 9. They are the only errors expected at this checkpoint.

- [ ] **Step 7: Don't commit yet**

`discover/page.tsx` still has type errors. Hold the commit until Task 9. The intervening tasks (4–8) touch files that compile independently.

---

### Task 4: RevealCountdown — UTC-midnight label

**Files:**
- Modify: `nichesurage/src/components/niche/RevealCountdown.tsx`
- Modify (if exists): `nichesurage/src/components/niche/RevealCountdown.test.tsx`
- Test: create one if missing.

The component already imports `getNextRevealAt` and `getMsUntilNextReveal`. After Task 2, both return UTC-midnight for FREE, `null` for Basic/Premium. The only change needed: copy text. If it currently reads "Next in 3h 22m" that's still meaningful — but the user-facing copy should make clear the rotation is daily, not 6h.

- [ ] **Step 1: Read current component**

```powershell
type src\components\niche\RevealCountdown.tsx
```

Identify where the countdown text is rendered. If the file uses a `formatHMS` style helper plus copy like `copy.discoverNextRevealIn(formatted)`, keep that. If it specifically says "6h" anywhere → remove.

- [ ] **Step 2: Write a test asserting the new behavior**

If a test file doesn't exist, create `nichesurage/src/components/niche/RevealCountdown.test.tsx`:

```tsx
/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { RevealCountdown } from './RevealCountdown'
import { COPY } from '@/components/landing/copy'

describe('RevealCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-05-22T23:30:00Z')) // 30 min before next reveal
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders nothing for basic tier', () => {
    const { container } = render(<RevealCountdown tier="basic" copy={COPY.en} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for premium tier', () => {
    const { container } = render(<RevealCountdown tier="premium" copy={COPY.en} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a countdown ≤24h for free tier', () => {
    render(<RevealCountdown tier="free" copy={COPY.en} />)
    // We don't assert the exact rendered string — only that *something*
    // referencing the next reveal renders. The countdown's exact format
    // is the responsibility of `copy.discoverNextRevealIn`.
    const el = screen.queryByText(/next/i)
    expect(el).not.toBeNull()
  })
})
```

- [ ] **Step 3: Run the test**

```powershell
npx jest src/components/niche/RevealCountdown.test.tsx
```

Expected: most cases pass already (no FREE-specific assertions broken). If "shows a countdown" fails because the COPY string changed, the patch is in copy.ts.

- [ ] **Step 4: If copy mentions "6 hours" anywhere — remove**

Search:

```bash
git grep -n '6h\|six hours\|6 hours\|6 sat' -- nichesurage/src/components nichesurage/src/lib
```

Anything user-facing referring to a 6h reveal cycle → update to daily / UTC midnight wording in `nichesurage/src/components/landing/copy.ts`. If nothing matches, the existing copy works because the underlying countdown just ticks down 24h instead of 6h.

If copy mentions "every 6 hours" or similar, replace with "every day at midnight UTC" (or shorter — match neighboring strings' tone).

- [ ] **Step 5: Run the test + full tier suite**

```powershell
npx jest src/components/niche/RevealCountdown.test.tsx src/lib/tier/
npx tsc --noEmit
```

Expected: PASS. The TS errors in `discover/page.tsx` are still pending (Task 9).

- [ ] **Step 6: Hold the commit**

This commits with Tasks 2, 3, and 9 because they all touch the reveal flow and TS isn't green yet.

---

### Task 5: `/api/demo/today` — ensure today's pin via `getDailyDemoNiche`

**Files:**
- Modify: `nichesurage/src/app/api/demo/today/route.ts`
- Modify: `nichesurage/src/app/api/demo/today/route.test.ts` (or create)

Currently the route does a raw `SELECT` against `daily_demo_niche`. If no auth callback has run today yet, anon visitors and returning-free users get `scanResultId: null`. That makes /discover render with everything blurred — wrong outcome.

Change: call `getDailyDemoNiche(createServiceClient())` and return `{ scanResultId: result?.scanResultId ?? null }`. The function does a SELECT first; only INSERTs on the cold path. Race-safe.

The `useFreeDemoState` consumer reads only `scanResultId` — same shape, no consumer change.

- [ ] **Step 1: Find existing tests**

```powershell
type src\app\api\demo\today\route.test.ts 2>$null
```

If file doesn't exist → create. If it exists, read what's there.

- [ ] **Step 2: Write / extend the test**

`nichesurage/src/app/api/demo/today/route.test.ts`:

```ts
/** @jest-environment node */

import { GET } from './route'

jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: jest.fn(),
}))

jest.mock('@/lib/tier/freeDemo', () => ({
  ...jest.requireActual('@/lib/tier/freeDemo'),
  getDailyDemoNiche: jest.fn(),
}))

import { getDailyDemoNiche } from '@/lib/tier/freeDemo'
import { createServiceClient } from '@/lib/supabase/service'

const mockedGetDailyDemoNiche = getDailyDemoNiche as jest.MockedFunction<typeof getDailyDemoNiche>
const mockedCreateServiceClient = createServiceClient as jest.MockedFunction<typeof createServiceClient>

describe('GET /api/demo/today', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedCreateServiceClient.mockReturnValue({ from: jest.fn() } as never)
  })

  it('returns the scanResultId when pin exists or was just inserted', async () => {
    mockedGetDailyDemoNiche.mockResolvedValue({
      scanResultId: 'sr-123',
      youtubeChannelId: 'UC-xyz',
      justInserted: false,
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ scanResultId: 'sr-123' })
  })

  it('returns null scanResultId when getDailyDemoNiche resolves null', async () => {
    mockedGetDailyDemoNiche.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ scanResultId: null })
  })

  it('sets cache headers when pin resolves', async () => {
    mockedGetDailyDemoNiche.mockResolvedValue({
      scanResultId: 'sr-123',
      youtubeChannelId: 'UC-xyz',
      justInserted: false,
    })
    const res = await GET()
    const cc = res.headers.get('Cache-Control')
    expect(cc).toMatch(/s-maxage=\d+/)
  })

  it('returns no-store when getDailyDemoNiche throws', async () => {
    mockedGetDailyDemoNiche.mockRejectedValue(new Error('db down'))
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ scanResultId: null })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})
```

- [ ] **Step 3: Run test, verify failures**

```powershell
npx jest src/app/api/demo/today/route.test.ts
```

Expected: the "returns null when getDailyDemoNiche resolves null" + "no-store on throw" cases fail because route currently inlines the SELECT and doesn't call `getDailyDemoNiche`.

- [ ] **Step 4: Update the route**

Replace `nichesurage/src/app/api/demo/today/route.ts` body with:

```ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getDailyDemoNiche } from '@/lib/tier/freeDemo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Returns today's globally-pinned demo niche scan_result_id.
//
// Read-mostly: getDailyDemoNiche SELECTs first; only INSERTs on the cold
// path of the day (first caller wins). All callers (anon /discover loads,
// useFreeDemoState validation, useDailyFreeModal returning-user trigger)
// see the same answer the auth callback's WOW redirect uses.
//
// CDN cache 5 min — the pin is immutable for the rest of the UTC day, so
// refreshing more often is wasted load.

export async function GET(): Promise<Response> {
  try {
    const supabase = createServiceClient()
    const pin = await getDailyDemoNiche(supabase)
    return NextResponse.json(
      { scanResultId: pin?.scanResultId ?? null },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        },
      },
    )
  } catch {
    return NextResponse.json(
      { scanResultId: null },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
```

- [ ] **Step 5: Run tests + full project**

```powershell
npx jest src/app/api/demo/today/
npx tsc --noEmit
```

Expected: route tests PASS. TS still red on `discover/page.tsx` only.

- [ ] **Step 6: Commit (Task 1 + 5 chunk: both green standalone)**

Task 1's `dailyModalCookie.ts` was committed in Task 1 Step 6. This commit is just Task 5.

```bash
git add nichesurage/src/app/api/demo/today/route.ts nichesurage/src/app/api/demo/today/route.test.ts
git commit -m "feat(free-tier): /api/demo/today ensures pin via getDailyDemoNiche (cold-day fix)"
```

---

### Task 6: `useDailyFreeModal` hook

**Files:**
- Create: `nichesurage/src/lib/demo/useDailyFreeModal.ts`
- Test: `nichesurage/src/lib/demo/useDailyFreeModal.test.tsx`

Hook decides whether to auto-open the daily modal for a FREE returning user. Inputs:
- `tier: UserTier` — only acts on `'free'`.
- `userLoading: boolean` — wait until tier known.
- `todayPinId: string | null` — passed by parent (already fetched via `/api/demo/today`). Hook does NOT fetch — keeps it pure and reusable.

Returns: `{ shouldOpen: boolean, markSeen: () => void }`.

Logic:
1. If not browser → `shouldOpen: false`.
2. If `userLoading` → `false`.
3. If `tier !== 'free'` → `false`.
4. If `todayPinId === null` → `false` (no pin yet today; can't show modal of nothing).
5. If `hasSeenDailyModal(document.cookie, now)` → `false`.
6. Else → `true`.

`markSeen()` calls `markDailyModalSeen(now)` AND triggers a re-render so the next-tick `shouldOpen` reads `false`. We need internal state for that.

- [ ] **Step 1: Write failing test**

`nichesurage/src/lib/demo/useDailyFreeModal.test.tsx`:

```tsx
/** @jest-environment jsdom */
import { renderHook, act } from '@testing-library/react'
import { useDailyFreeModal } from './useDailyFreeModal'
import { DAILY_MODAL_COOKIE_NAME } from './dailyModalCookie'

function clearCookies() {
  // jsdom: overwrite every named cookie with expired one
  document.cookie = `${DAILY_MODAL_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}

describe('useDailyFreeModal', () => {
  beforeEach(() => {
    clearCookies()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-05-22T14:00:00Z'))
  })
  afterEach(() => {
    clearCookies()
    jest.useRealTimers()
  })

  it('returns shouldOpen=false while user loading', () => {
    const { result } = renderHook(() =>
      useDailyFreeModal({ tier: 'free', userLoading: true, todayPinId: 'sr-1' }),
    )
    expect(result.current.shouldOpen).toBe(false)
  })

  it('returns shouldOpen=false for premium', () => {
    const { result } = renderHook(() =>
      useDailyFreeModal({ tier: 'premium', userLoading: false, todayPinId: 'sr-1' }),
    )
    expect(result.current.shouldOpen).toBe(false)
  })

  it('returns shouldOpen=false for basic', () => {
    const { result } = renderHook(() =>
      useDailyFreeModal({ tier: 'basic', userLoading: false, todayPinId: 'sr-1' }),
    )
    expect(result.current.shouldOpen).toBe(false)
  })

  it('returns shouldOpen=false when pin is null', () => {
    const { result } = renderHook(() =>
      useDailyFreeModal({ tier: 'free', userLoading: false, todayPinId: null }),
    )
    expect(result.current.shouldOpen).toBe(false)
  })

  it('returns shouldOpen=true for free + pin + no cookie', () => {
    const { result } = renderHook(() =>
      useDailyFreeModal({ tier: 'free', userLoading: false, todayPinId: 'sr-1' }),
    )
    expect(result.current.shouldOpen).toBe(true)
  })

  it('returns shouldOpen=false when cookie already set for today', () => {
    document.cookie = `${DAILY_MODAL_COOKIE_NAME}=2026-05-22; path=/`
    const { result } = renderHook(() =>
      useDailyFreeModal({ tier: 'free', userLoading: false, todayPinId: 'sr-1' }),
    )
    expect(result.current.shouldOpen).toBe(false)
  })

  it('returns shouldOpen=true when cookie has yesterday', () => {
    document.cookie = `${DAILY_MODAL_COOKIE_NAME}=2026-05-21; path=/`
    const { result } = renderHook(() =>
      useDailyFreeModal({ tier: 'free', userLoading: false, todayPinId: 'sr-1' }),
    )
    expect(result.current.shouldOpen).toBe(true)
  })

  it('markSeen() flips shouldOpen to false on next render', () => {
    const { result, rerender } = renderHook(
      ({ pin }) => useDailyFreeModal({ tier: 'free', userLoading: false, todayPinId: pin }),
      { initialProps: { pin: 'sr-1' as string | null } },
    )
    expect(result.current.shouldOpen).toBe(true)

    act(() => {
      result.current.markSeen()
    })

    // Re-render with the same props; markSeen has now written the cookie.
    rerender({ pin: 'sr-1' })
    expect(result.current.shouldOpen).toBe(false)
    expect(document.cookie).toContain(`${DAILY_MODAL_COOKIE_NAME}=2026-05-22`)
  })
})
```

- [ ] **Step 2: Run test, verify failure**

```powershell
npx jest src/lib/demo/useDailyFreeModal.test.tsx
```

Expected: FAIL — file missing.

- [ ] **Step 3: Implement the hook**

`nichesurage/src/lib/demo/useDailyFreeModal.ts`:

```ts
'use client'

import { useCallback, useState } from 'react'
import type { UserTier } from '@/lib/types/database'
import {
  hasSeenDailyModal,
  markDailyModalSeen,
} from './dailyModalCookie'

// Returning-FREE-user daily modal trigger.
//
// Separate from useFreeDemoState (which validates the FIRST-LOGIN URL
// signal). This hook reads the daily cookie + the tier + today's pin and
// decides whether the modal should open *automatically* on /discover.
//
// Caller is responsible for fetching todayPinId from /api/demo/today.

export interface UseDailyFreeModalArgs {
  tier: UserTier
  userLoading: boolean
  todayPinId: string | null
}

export interface UseDailyFreeModalResult {
  shouldOpen: boolean
  markSeen: () => void
}

export function useDailyFreeModal(
  args: UseDailyFreeModalArgs,
): UseDailyFreeModalResult {
  const { tier, userLoading, todayPinId } = args
  // Bump on markSeen so a re-read of document.cookie happens next render.
  const [seenTick, setSeenTick] = useState(0)

  const browser = typeof window !== 'undefined'
  let shouldOpen = false
  if (browser && !userLoading && tier === 'free' && todayPinId) {
    const now = new Date()
    shouldOpen = !hasSeenDailyModal(document.cookie, now)
  }
  // seenTick is referenced to keep the value in the dep graph — without
  // this line, the closure could be eliminated by an over-eager bundler.
  void seenTick

  const markSeen = useCallback(() => {
    if (typeof window === 'undefined') return
    markDailyModalSeen(new Date())
    setSeenTick((t) => t + 1)
  }, [])

  return { shouldOpen, markSeen }
}
```

- [ ] **Step 4: Run test, verify pass**

```powershell
npx jest src/lib/demo/useDailyFreeModal.test.tsx
```

Expected: PASS, all 8 assertions.

- [ ] **Step 5: TS + commit**

```powershell
npx tsc --noEmit
```

Expected: still red on `discover/page.tsx` (intervening tasks haven't touched it). Anything else → STOP and reconcile.

```bash
git add nichesurage/src/lib/demo/useDailyFreeModal.ts nichesurage/src/lib/demo/useDailyFreeModal.test.tsx
git commit -m "feat(free-tier): useDailyFreeModal hook for returning-user trigger"
```

---

### Task 7: `DailyFreeModal` component

**Files:**
- Create: `nichesurage/src/components/niche/DailyFreeModal.tsx`
- Test: `nichesurage/src/components/niche/DailyFreeModal.test.tsx`

The component is a thin wrapper around the existing `NicheDetailModal` shell that loads today's pin and renders `NicheDetailContent` with `tier='free'` (so AI sections render their locked teaser like on any other niche) and a header line like "Today's free niche — explore the data, upgrade to unlock AI". No `FreeDemoBanner` (that's first-login only). Close button → calls `markSeen()` + `onClose()`.

Props:
```ts
interface DailyFreeModalProps {
  open: boolean
  todayPinId: string  // non-null caller guard
  copy: CopyKeys
  onClose: () => void
}
```

Component fetches the full niche by id via the existing `fetchNicheById` (same as `/discover` modal flow).

- [ ] **Step 1: Write the failing test**

`nichesurage/src/components/niche/DailyFreeModal.test.tsx`:

```tsx
/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DailyFreeModal } from './DailyFreeModal'
import { COPY } from '@/components/landing/copy'

jest.mock('@/lib/supabase/queries', () => ({
  fetchNicheById: jest.fn(),
  fetchSpikeHistory: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/lib/supabase/savedNiches', () => ({
  fetchSavedNicheIds: jest.fn().mockResolvedValue(new Set()),
}))

jest.mock('@/lib/context/UserContext', () => ({
  useUser: () => ({ tier: 'free', userId: 'u-1', loading: false }),
}))

import { fetchNicheById } from '@/lib/supabase/queries'

const mockedFetchNicheById = fetchNicheById as jest.MockedFunction<typeof fetchNicheById>

const fakeNiche = {
  id: 'sr-1',
  channelName: 'Pinned Channel',
  youtubeChannelId: 'UC-pin',
  nicheLabel: 'AI Tutorials',
  // … other fields rendered by NicheDetailContent; fill minimum that
  // prevents the component from crashing. If the component requires more
  // fields, extend the fixture rather than disabling assertions.
} as never

describe('DailyFreeModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedFetchNicheById.mockResolvedValue(fakeNiche)
  })

  it('renders nothing when open=false', () => {
    const { container } = render(
      <DailyFreeModal open={false} todayPinId="sr-1" copy={COPY.en} onClose={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('fetches and renders today\'s pin when open=true', async () => {
    render(
      <DailyFreeModal open todayPinId="sr-1" copy={COPY.en} onClose={() => {}} />,
    )
    await waitFor(() => expect(mockedFetchNicheById).toHaveBeenCalledWith('sr-1'))
    expect(await screen.findByText(/Pinned Channel/)).toBeInTheDocument()
  })

  it('calls onClose when the user clicks the close button', async () => {
    const onClose = jest.fn()
    render(
      <DailyFreeModal open todayPinId="sr-1" copy={COPY.en} onClose={onClose} />,
    )
    // The close button comes from NicheDetailModal — usually has
    // aria-label "Close" or similar. Match whichever the shell exposes.
    const closeButton = await screen.findByRole('button', { name: /close/i })
    await userEvent.click(closeButton)
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

```powershell
npx jest src/components/niche/DailyFreeModal.test.tsx
```

Expected: FAIL — `Cannot find module './DailyFreeModal'`.

- [ ] **Step 3: Implement the component**

`nichesurage/src/components/niche/DailyFreeModal.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { NicheDetailModal } from './NicheDetailModal'
import { NicheDetailContent } from './NicheDetailContent'
import { fetchNicheById, fetchSpikeHistory } from '@/lib/supabase/queries'
import { fetchSavedNicheIds } from '@/lib/supabase/savedNiches'
import type { CopyKeys } from '@/components/landing/copy'
import type { NicheCardData, SpikePoint } from '@/lib/types'

interface DailyFreeModalProps {
  open: boolean
  todayPinId: string
  copy: CopyKeys
  onClose: () => void
}

export function DailyFreeModal({ open, todayPinId, copy, onClose }: DailyFreeModalProps) {
  const [niche, setNiche] = useState<NicheCardData | null>(null)
  const [history, setHistory] = useState<SpikePoint[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const n = await fetchNicheById(todayPinId)
      if (cancelled || !n) {
        setLoading(false)
        return
      }
      setNiche(n)
      const [hist, saved] = await Promise.all([
        fetchSpikeHistory(n.youtubeChannelId),
        fetchSavedNicheIds(),
      ])
      if (cancelled) return
      setHistory(hist)
      setSavedIds(saved)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [open, todayPinId])

  if (!open) return null

  return (
    <NicheDetailModal
      open={open}
      onClose={onClose}
      ariaLabel={niche?.channelName ?? 'Today’s free niche'}
    >
      {loading || !niche ? (
        <div data-testid="daily-free-modal-skeleton" className="space-y-4">
          <div className="glass rounded-2xl p-6 space-y-3">
            <div className="h-3 w-24 shimmer rounded" />
            <div className="h-7 w-2/3 shimmer rounded" />
          </div>
        </div>
      ) : (
        <NicheDetailContent
          key={niche.id}
          niche={niche}
          history={history}
          tier="free"
          copy={copy}
          isSaved={savedIds.has(niche.id)}
          savedCount={savedIds.size}
          onBookmarkToggle={() => {}}
          onRelatedClick={() => { /* daily modal is single-niche — no related navigation */ }}
        />
      )}
    </NicheDetailModal>
  )
}
```

If `NicheDetailContent` props differ from what's shown (e.g. it requires more fields, or `onBookmarkToggle` takes `(id, saved)` not `()`), adjust to match the real signature. Run TS to see exact mismatches.

- [ ] **Step 4: Run tests + TS**

```powershell
npx jest src/components/niche/DailyFreeModal.test.tsx
npx tsc --noEmit
```

Expected: tests PASS. TS may surface prop-shape mismatches; fix inline against the real `NicheDetailContentProps`.

- [ ] **Step 5: Commit**

```bash
git add nichesurage/src/components/niche/DailyFreeModal.tsx nichesurage/src/components/niche/DailyFreeModal.test.tsx
git commit -m "feat(free-tier): DailyFreeModal component (read-only returning-user modal)"
```

---

### Task 8: Wire up `discover/page.tsx`

**Files:**
- Modify: `nichesurage/src/app/discover/page.tsx`

Three threads to weave:
1. Fetch today's pin via `/api/demo/today` on mount; store in state.
2. Pass `todayPinId` into `getRevealedIds` + `computeVisibleResults`.
3. On the `useDailyFreeModal().shouldOpen === true` branch, render `<DailyFreeModal />`. On close → call `markSeen()`.

Because the page is `'use client'`, fetch via plain `fetch('/api/demo/today')` in a `useEffect`.

- [ ] **Step 1: Sketch the diff (no test for this orchestration file; integration coverage lives in the route + hook tests + the manual smoke at end)**

The relevant edits to `nichesurage/src/app/discover/page.tsx`:

a) Add imports near the top of the file:

```ts
import { useDailyFreeModal } from '@/lib/demo/useDailyFreeModal'
import { DailyFreeModal } from '@/components/niche/DailyFreeModal'
```

b) Inside `DiscoverPageInner`, after the `useState` for `upsellOpen`, add:

```ts
const [todayPinId, setTodayPinId] = useState<string | null>(null)

useEffect(() => {
  let cancelled = false
  fetch('/api/demo/today', { cache: 'no-store' })
    .then((r) => r.ok ? r.json() : Promise.resolve({ scanResultId: null }))
    .then((body) => {
      if (cancelled) return
      const id = typeof body?.scanResultId === 'string' ? body.scanResultId : null
      setTodayPinId(id)
    })
    .catch(() => { if (!cancelled) setTodayPinId(null) })
  return () => { cancelled = true }
}, [])

const { shouldOpen: dailyModalOpen, markSeen } = useDailyFreeModal({
  tier: userTier,
  userLoading,
  todayPinId,
})
const [dailyModalDismissed, setDailyModalDismissed] = useState(false)
const showDailyModal = dailyModalOpen && !dailyModalDismissed && !nicheParam
// nicheParam guard: if the user opened a niche detail modal (or first-login flow set ?freeDemo=true with ?niche=…), suppress the daily modal — only one modal at a time.
```

(`nicheParam` is read later in the component — move the daily modal block to AFTER `const nicheParam = searchParams.get('niche')`. The order in the existing file is: state → derived → effects → modal block. Reorder so `nicheParam` is computed before the daily-modal effect.)

c) Replace the `revealedIds` memo:

```ts
const revealedIds = useMemo(() => {
  const ids = results.map((n) => n.id)
  return getRevealedIds(userTier, ids, userId ?? '', new Date(), todayPinId)
}, [results, userTier, userId, todayPinId])
```

d) Replace the `visibleResults` memo:

```ts
const visibleResults = useMemo(() => {
  return computeVisibleResults({
    tier: userTier,
    userId: userId ?? '',
    results,
    visibleCount,
    now: new Date(),
    todayPinId,
  })
}, [results, userTier, userId, visibleCount, todayPinId])
```

e) Render the daily modal near the existing modal block:

```tsx
{showDailyModal && todayPinId && (
  <DailyFreeModal
    open
    todayPinId={todayPinId}
    copy={copy}
    onClose={() => {
      markSeen()
      setDailyModalDismissed(true)
    }}
  />
)}
```

- [ ] **Step 2: Apply the edits**

Use the Edit tool to apply each of (a)–(e) above to `nichesurage/src/app/discover/page.tsx`. Confirm by reading the file after the last edit.

- [ ] **Step 3: TS check**

```powershell
npx tsc --noEmit
```

Expected: green (all earlier red entries on this file should now be resolved).

- [ ] **Step 4: Full test suite**

```powershell
npx jest
```

Expected: PASS for everything. If a snapshot or other test breaks because the discover page changed render output, update assertions deliberately — do not blindly `--updateSnapshot`.

- [ ] **Step 5: Commit the bundle (Tasks 2, 3, 4, 8)**

These changes are coupled — TS only goes green after step 8. Commit them as one logical changeset.

```bash
git add nichesurage/src/lib/tier/reveal.ts nichesurage/src/lib/tier/reveal.test.ts nichesurage/src/lib/tier/visibleResults.ts nichesurage/src/lib/tier/visibleResults.test.ts nichesurage/src/components/niche/RevealCountdown.tsx nichesurage/src/components/landing/copy.ts nichesurage/src/app/discover/page.tsx
# If RevealCountdown.test.tsx was added, include it:
git add nichesurage/src/components/niche/RevealCountdown.test.tsx
git commit -m "feat(free-tier): pin-driven reveal, UTC-midnight rotation, daily modal on /discover

- getRevealedIds + computeVisibleResults take todayPinId (1 unlocked niche/day)
- 6h hash-window rotation removed for FREE
- /discover fetches today's pin and triggers DailyFreeModal for returning users"
```

If `copy.ts` was not touched (no '6h' strings existed), drop it from the `git add` list.

---

### Task 9: Pass legitimacy signal through AI children

**Files:**
- Modify: `nichesurage/src/components/niche/NicheDetailContent.tsx`
- Modify: `nichesurage/src/components/niche/HealthCheckInline.tsx`
- Modify: `nichesurage/src/components/niche/HealthCheckModal.tsx`
- Modify: `nichesurage/src/components/niche/AIContentAngles.tsx`

The bypass currently fires for any FREE request hitting today's pin scan_id, including a returning-user daily-modal flow. The fix: thread `isLegitimateDemo` (derived from `useFreeDemoState() === 'legitimate'`) into the three AI children. When `true`, they append `?demo=1` to the fetch URL. Server enforces all 3 (param + cookie + scan match) in Tasks 10–11.

- [ ] **Step 1: NicheDetailContent — pass the boolean**

Open `nichesurage/src/components/niche/NicheDetailContent.tsx`. After line 64 (existing `const demoState = useFreeDemoState(niche.id)`), the `aiTier` is computed. Add:

```ts
const isLegitimateDemo = demoState === 'legitimate' && tier === 'free'
```

Then pass `isLegitimateDemo` to `<HealthCheckInline ... />` and `<AIContentAngles ... />` (and `<HealthCheckModal />` if it's rendered here — confirm by reading the file).

```tsx
<HealthCheckInline scanResultId={niche.id} userTier={aiTier} copy={copy} isLegitimateDemo={isLegitimateDemo} />
<AIContentAngles scanResultId={niche.id} userTier={aiTier} copy={copy} isLegitimateDemo={isLegitimateDemo} />
```

- [ ] **Step 2: HealthCheckInline — accept prop and append `?demo=1`**

Open `nichesurage/src/components/niche/HealthCheckInline.tsx`. Add `isLegitimateDemo?: boolean` to the props interface. Update the fetch URL:

```ts
const qs = isLegitimateDemo ? '?demo=1' : ''
const res = await fetch(`/api/health-check/${encodeURIComponent(scanResultId)}${qs}`)
```

Existing tests for HealthCheckInline pass `userTier='premium'` directly; they don't exercise this prop and should remain green.

- [ ] **Step 3: HealthCheckModal — same change**

Open `nichesurage/src/components/niche/HealthCheckModal.tsx`. Apply the same edits (props + URL).

- [ ] **Step 4: AIContentAngles — same change**

Open `nichesurage/src/components/niche/AIContentAngles.tsx`. Same edits — line 40 `fetch('/api/content-angles/...')` gets the `?demo=1` suffix when `isLegitimateDemo`.

- [ ] **Step 5: Update consumers if any other parent renders these components**

```bash
git grep -n 'HealthCheckInline\|HealthCheckModal\|AIContentAngles' -- 'nichesurage/src' ':!*/node_modules/*'
```

For every other usage site, decide:
- If the call site is the legitimate first-login flow (lives behind a `useFreeDemoState === 'legitimate'` gate) → pass `isLegitimateDemo={true}`.
- Otherwise → pass `isLegitimateDemo={false}` or omit (default-false via optional prop).

Document each touched call site in the commit message.

- [ ] **Step 6: TS + tests**

```powershell
npx tsc --noEmit
npx jest
```

Expected: green.

- [ ] **Step 7: Commit**

```bash
git add nichesurage/src/components/niche/NicheDetailContent.tsx nichesurage/src/components/niche/HealthCheckInline.tsx nichesurage/src/components/niche/HealthCheckModal.tsx nichesurage/src/components/niche/AIContentAngles.tsx
# include any other call sites touched
git commit -m "feat(free-tier): thread isLegitimateDemo signal into AI fetches (?demo=1 query)"
```

---

### Task 10: Narrow `/api/health-check/[id]` bypass

**Files:**
- Modify: `nichesurage/src/app/api/health-check/[id]/route.ts`
- Modify: `nichesurage/src/app/api/health-check/[id]/route.test.ts` (or create)

Today `isTodaysDemoNiche` checks only `scan_id`. After this task, the bypass requires three signals:
1. Request URL has `?demo=1`.
2. Request includes the `surgeniche_demo_seen` cookie.
3. Scan id matches today's pinned `daily_demo_niche` row.

All three must be true. Otherwise → no bypass → tier check runs → FREE gets 403.

- [ ] **Step 1: Add failing tests**

Add to `nichesurage/src/app/api/health-check/[id]/route.test.ts` (read existing test file structure first; mirror its existing mocking patterns for `createClient`, `createServiceClient`):

```ts
// (Inside the existing describe block, add these cases)

describe('demo bypass narrowing (free-tier paywall fix)', () => {
  it('FREE returning user hitting today\'s pin without ?demo=1 → 403', async () => {
    // Arrange: today's pin = 'sr-1'. Request URL has no demo param.
    // Cookie absent. Tier=free.
    mockTodaysPin('sr-1')
    mockUserTier('free')
    const req = new Request('https://app/api/health-check/sr-1')
    const res = await GET(req, { params: { id: 'sr-1' } })
    expect(res.status).toBe(403)
  })

  it('FREE first-login (?demo=1 + cookie + match) → 200 cached demo path', async () => {
    mockTodaysPin('sr-1')
    mockUserTier('free')
    mockCachedHealthCheck('sr-1')
    const req = new Request('https://app/api/health-check/sr-1?demo=1', {
      headers: { cookie: 'surgeniche_demo_seen=1' },
    })
    const res = await GET(req, { params: { id: 'sr-1' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.demo).toBe(true)
  })

  it('FREE ?demo=1 but no cookie → 403 (URL forgery)', async () => {
    mockTodaysPin('sr-1')
    mockUserTier('free')
    const req = new Request('https://app/api/health-check/sr-1?demo=1')
    const res = await GET(req, { params: { id: 'sr-1' } })
    expect(res.status).toBe(403)
  })

  it('FREE ?demo=1 + cookie but scan mismatch → 403', async () => {
    mockTodaysPin('sr-OTHER')
    mockUserTier('free')
    const req = new Request('https://app/api/health-check/sr-1?demo=1', {
      headers: { cookie: 'surgeniche_demo_seen=1' },
    })
    const res = await GET(req, { params: { id: 'sr-1' } })
    expect(res.status).toBe(403)
  })

  it('PREMIUM never needs ?demo=1 — bypass irrelevant', async () => {
    mockTodaysPin('sr-1')
    mockUserTier('premium')
    mockCachedHealthCheck('sr-1')
    const req = new Request('https://app/api/health-check/sr-1')
    const res = await GET(req, { params: { id: 'sr-1' } })
    expect(res.status).toBe(200)
  })
})
```

`mockTodaysPin`, `mockUserTier`, `mockCachedHealthCheck` should mirror whatever helper pattern the existing tests use. Read the existing test file first to copy the style.

- [ ] **Step 2: Run, expect failures**

```powershell
npx jest src/app/api/health-check/
```

Expected: failures on "FREE returning user … 403" (current code returns 200 demo) and "FREE first-login → 200" if the helper params differ.

- [ ] **Step 3: Narrow `isTodaysDemoNiche` to require all 3 signals**

Update `nichesurage/src/app/api/health-check/[id]/route.ts`:

a) `GET(_req, ...)` → `GET(req, ...)` (read the request).

b) Replace the line `const isDemoNiche = await isTodaysDemoNiche(params.id)` with:

```ts
const url = new URL(req.url)
const demoParam = url.searchParams.get('demo')
const demoCookie = parseDemoSeenCookie(req.headers.get('cookie'))
const wantsDemoBypass = demoParam === '1' && demoCookie
const isDemoNiche = wantsDemoBypass && await isTodaysDemoNiche(params.id)
```

c) Add the helper at the bottom of the file:

```ts
function parseDemoSeenCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false
  return cookieHeader
    .split(';')
    .some((c) => c.trim().startsWith('surgeniche_demo_seen='))
}
```

`isTodaysDemoNiche` body stays the same.

- [ ] **Step 4: Run tests, verify green**

```powershell
npx jest src/app/api/health-check/
```

Expected: PASS. If a previously-green test relied on the demo bypass without `?demo=1`/cookie, update it deliberately (probably needs to add the headers).

- [ ] **Step 5: TS + commit**

```powershell
npx tsc --noEmit
npx jest
```

Both green. Then:

```bash
git add nichesurage/src/app/api/health-check/[id]/route.ts nichesurage/src/app/api/health-check/[id]/route.test.ts
git commit -m "fix(free-tier): /api/health-check bypass requires ?demo=1 + cookie + scan match"
```

---

### Task 11: Narrow `/api/content-angles/[id]` bypass

**Files:**
- Modify: `nichesurage/src/app/api/content-angles/[id]/route.ts`
- Modify: `nichesurage/src/app/api/content-angles/[id]/route.test.ts` (or create)

Identical change to Task 10. The route's `isTodaysDemoNiche` check (around line 23 of the file per spec) gets the same three-signal gate.

- [ ] **Step 1: Read the existing route**

```powershell
type src\app\api\content-angles\[id]\route.ts
```

Confirm the bypass entry point. If the layout is identical to `health-check`, copy the same patch.

- [ ] **Step 2: Apply the same patch as Task 10**

Add `req` param, parse URL + cookie, gate `isDemoNiche` by `demoParam === '1' && demoCookie`. Add the `parseDemoSeenCookie` helper (or extract it to a shared module — see follow-up below).

- [ ] **Step 3: Mirror the Task 10 tests for content-angles**

Add the same 5 test cases (substituting `content-angles` for `health-check`) to `nichesurage/src/app/api/content-angles/[id]/route.test.ts`.

- [ ] **Step 4: Run tests**

```powershell
npx jest src/app/api/content-angles/
npx tsc --noEmit
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add nichesurage/src/app/api/content-angles/[id]/route.ts nichesurage/src/app/api/content-angles/[id]/route.test.ts
git commit -m "fix(free-tier): /api/content-angles bypass requires ?demo=1 + cookie + scan match"
```

**Follow-up to consider during review (not blocking ship):** `parseDemoSeenCookie` is duplicated across both routes. If the reviewer prefers, extract it to `nichesurage/src/lib/demo/serverCookies.ts` and import from both. Keep it inline for v1 if the reviewer is fine with the duplication.

---

### Task 12: Whole-project verification + push

**Files:** none modified — verification only.

- [ ] **Step 1: TS clean**

```powershell
cd nichesurage
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Full test suite**

```powershell
npm test -- --runInBand
```

Expected: ALL tests pass. Note the new total (`548 + new tests` from this plan, roughly 580–600).

- [ ] **Step 3: Build**

```powershell
npm run build
```

Expected: webpack compile clean. No new "Module not found" or client/server boundary warnings.

- [ ] **Step 4: Push**

```bash
cd c:\Users\AURUMPC\Desktop\YT-app
git push -u origin fix/free-tier-paywall
```

- [ ] **Step 5: PR**

```bash
gh pr create --title "fix(free-tier): paywall hardening — 1 niche/day, AI bypass narrowed" --body @- <<'EOF'
## Summary

- Replaces per-user 6h hash-windowed reveal with the globally-pinned `daily_demo_niche` row for FREE tier. Same unlocked niche across all `/discover` surface tabs and across anon vs. logged-in.
- Adds `DailyFreeModal` for returning FREE users — one open per UTC day per device, cookie-tracked, read-only (no AI bypass).
- Narrows `/api/health-check` and `/api/content-angles` demo bypass: now requires `?demo=1` URL param + `surgeniche_demo_seen` cookie + scan match. Returning FREE users on today's pin → 403 on AI buttons.
- First-login WOW flow (auth callback + pre-warmed AI) is untouched.

## Test plan
- [ ] Anon visitor /discover: 1 unlocked (today's pin), rest blurred, no modal
- [ ] FREE first-login: existing redirect → demo modal with AI (regression check)
- [ ] FREE returning, no cookie: daily modal auto-opens, AI buttons locked
- [ ] FREE returning, cookie set: no modal, 1 unlocked
- [ ] FREE clicks AI on today's pin without first-login URL → 403
- [ ] Cross-tab consistency: all / spiking-now / just-added show the same unlocked niche
- [ ] BASIC and PREMIUM tiers unchanged

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Step 6: Wait for Vercel preview + run smoke tests**

After preview deploys, run the 7 manual scenarios from the spec's "Verification" section against the preview URL before merge.

---

## Cross-task notes

**Risk: existing tests that mock `getDailyDemoNiche` or hit `/api/demo/today`.** A handful of integration tests may depend on the read-only behavior. Task 5 step 3 surfaces these; fix-forward in the same step rather than carrying broken assertions.

**Risk: `useFreeDemoState` validation timing.** First-login flow uses `?freeDemo=true` + cookie + match (server returns matching scan_id from `/api/demo/today`). Tasks 5 changes that endpoint to also do the insert. If a test mocks `/api/demo/today` to return null, the demo state will read `'not-demo'` — that test now needs the mock to return a scan id. Inspect when Step 5 runs.

**Risk: race between auth callback `getDailyDemoNiche` insert and a first-of-day anon visitor.** Both call the same race-safe function; only one INSERT succeeds, the other re-reads. No new race surface.

**Out of plan scope (must not be added):**
- Tracking analytics (PostHog events for modal open/dismiss).
- A/B test infra for conversion measurement.
- Per-device modal tracking via DB rather than cookie.
- Smarter pin selection (curated rotation by category).
- Phase 1 admin Users page work.
- Cron rate-limit follow-up.
