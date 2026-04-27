# NicheCard Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build six React components that display YouTube niche opportunity data with tier-based data gating (free users see blurred/locked fields, basic/premium users see everything).

**Architecture:** Bottom-up: leaf components first (LockedField, SpikeIndicator, ScoreBar, NicheCardSkeleton), then the NicheCard orchestrator which composes them. Tests are written first in NicheCard.test.tsx; they fail until all components exist. TDD order: write tests → implement leaves → implement NicheCard → all tests green.

**Tech Stack:** React 18, Next.js 14, TypeScript, Tailwind CSS 3, Jest 30, @testing-library/react 16

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/niche/NicheCard.test.tsx` | Create | All tests (3 cases) |
| `src/components/niche/LockedField.tsx` | Create | Blur wrapper for gated fields |
| `src/components/niche/SpikeIndicator.tsx` | Create | Spike multiplier badge (normal + MEGA) |
| `src/components/niche/ScoreBar.tsx` | Create | Gradient progress bar for opportunity score |
| `src/components/niche/NicheCardSkeleton.tsx` | Create | animate-pulse loading placeholder |
| `src/components/niche/NicheCard.tsx` | Create | Orchestrator — composes all above |

No existing files are modified.

---

### Task 1: Write the failing tests

**Files:**
- Create: `src/components/niche/NicheCard.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// src/components/niche/NicheCard.test.tsx
import { render, screen } from '@testing-library/react'
import { NicheCard } from './NicheCard'
import { NicheCardSkeleton } from './NicheCardSkeleton'
import type { NicheCardData } from '@/lib/types'

const baseData: NicheCardData = {
  id: '1',
  channelCreatedAt: '2024-01-01',
  videoCount: 47,
  subscriberRange: '1K–10K',
  spikeMultiplier: 6.2,
  opportunityScore: 78,
  viralityRating: 'excellent',
  language: 'de',
}

const basicData: NicheCardData = {
  ...baseData,
  channelName: 'Tech Tutorials DE',
  nicheLabel: 'YouTube Shorts · Tech',
  channelUrl: 'https://youtube.com/@techde',
  engagementRate: 4.2,
}

describe('NicheCard', () => {
  it('free tier: blurred elements present, no channel link, no engagement badge, lock icon shown', () => {
    render(<NicheCard data={baseData} userTier="free" rank={1} />)

    // No <a> tag — channel name is blurred text, not a link
    expect(screen.queryByRole('link')).toBeNull()

    // At least one element has blur applied
    const blurred = document.querySelector('[style*="blur"]')
    expect(blurred).not.toBeNull()

    // No engagement rate badge (undefined for free tier)
    expect(screen.queryByText(/eng/)).toBeNull()

    // Lock icon present next to channel name
    expect(screen.getByText('🔒')).toBeTruthy()
  })

  it('basic tier: channel name is a link, virality badge unblurred, engagement badge present', () => {
    render(<NicheCard data={basicData} userTier="basic" rank={1} />)

    // Channel name is an <a> link pointing to channelUrl
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://youtube.com/@techde')

    // Virality badge visible and not blurred
    const viralityEl = screen.getByText(/Excellent/i)
    expect(viralityEl).not.toHaveStyle('filter: blur(5px)')

    // Engagement rate badge present
    expect(screen.getByText(/eng/)).toBeTruthy()
  })

  it('skeleton: renders without errors, contains animate-pulse elements', () => {
    render(<NicheCardSkeleton />)
    const pulseEls = document.querySelectorAll('.animate-pulse')
    expect(pulseEls.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail (import errors expected)**

```bash
cd nichesurage && npx jest src/components/niche/NicheCard.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module './NicheCard'`

---

### Task 2: LockedField component

**Files:**
- Create: `src/components/niche/LockedField.tsx`

- [ ] **Step 1: Implement LockedField**

```tsx
// src/components/niche/LockedField.tsx
import { ReactNode } from 'react'

interface LockedFieldProps {
  locked: boolean
  children: ReactNode
  className?: string
}

export function LockedField({ locked, children, className = '' }: LockedFieldProps) {
  if (!locked) return <>{children}</>
  return (
    <span
      style={{ filter: 'blur(5px)' }}
      title="Upgrade to Basic to unlock"
      className={`cursor-help select-none ${className}`}
    >
      {children}
    </span>
  )
}
```

- [ ] **Step 2: Run tests (still fail — other components missing)**

```bash
cd nichesurage && npx jest src/components/niche/NicheCard.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module './SpikeIndicator'` (or similar missing module)

- [ ] **Step 3: Commit LockedField**

```bash
git add nichesurage/src/components/niche/LockedField.tsx nichesurage/src/components/niche/NicheCard.test.tsx
git commit -m "feat: add LockedField component and NicheCard tests"
```

---

### Task 3: SpikeIndicator component

**Files:**
- Create: `src/components/niche/SpikeIndicator.tsx`

- [ ] **Step 1: Implement SpikeIndicator**

Two visual variants: `multiplier >= 5` → MEGA (orange bordered box), otherwise plain orange text.

```tsx
// src/components/niche/SpikeIndicator.tsx
interface SpikeIndicatorProps {
  multiplier: number
}

export function SpikeIndicator({ multiplier }: SpikeIndicatorProps) {
  if (multiplier >= 5) {
    return (
      <div className="bg-orange-950 border border-orange-700 rounded-lg p-2 text-right">
        <div className="text-orange-400 text-2xl font-extrabold tracking-tight">{multiplier}×</div>
        <div className="text-orange-800 text-xs uppercase tracking-wide">MEGA</div>
      </div>
    )
  }
  return (
    <div className="text-right">
      <div className="text-orange-400 text-xl font-bold">{multiplier}×</div>
      <div className="text-slate-500 text-xs uppercase tracking-wide">spike</div>
    </div>
  )
}
```

- [ ] **Step 2: Commit SpikeIndicator**

```bash
git add nichesurage/src/components/niche/SpikeIndicator.tsx
git commit -m "feat: add SpikeIndicator component (normal + MEGA variants)"
```

---

### Task 4: ScoreBar component

**Files:**
- Create: `src/components/niche/ScoreBar.tsx`

- [ ] **Step 1: Implement ScoreBar**

Gradient progress bar (indigo → purple), score 0–100. Bar width set via inline style.

```tsx
// src/components/niche/ScoreBar.tsx
interface ScoreBarProps {
  score: number
}

export function ScoreBar({ score }: ScoreBarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-800 rounded h-1.5">
        <div
          className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded"
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-purple-400 text-xs font-bold">{score}</span>
      <span className="text-slate-500 text-xs">score</span>
    </div>
  )
}
```

- [ ] **Step 2: Commit ScoreBar**

```bash
git add nichesurage/src/components/niche/ScoreBar.tsx
git commit -m "feat: add ScoreBar gradient progress component"
```

---

### Task 5: NicheCardSkeleton component

**Files:**
- Create: `src/components/niche/NicheCardSkeleton.tsx`

- [ ] **Step 1: Implement NicheCardSkeleton**

All blocks use `animate-pulse`. Outer wrapper also has `animate-pulse` so the test selector `document.querySelectorAll('.animate-pulse')` finds it.

```tsx
// src/components/niche/NicheCardSkeleton.tsx
export function NicheCardSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 animate-pulse">
      {/* Header row */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex-1">
          <div className="bg-slate-800 rounded h-2.5 w-14 mb-2" />
          <div className="bg-slate-800 rounded h-4 w-40" />
        </div>
        <div className="bg-slate-800 rounded-lg w-14 h-12" />
      </div>
      {/* Badge row */}
      <div className="flex gap-1.5 mb-3">
        <div className="bg-slate-800 rounded-full h-5 w-20" />
        <div className="bg-slate-800 rounded-full h-5 w-24" />
        <div className="bg-slate-800 rounded-full h-5 w-16" />
      </div>
      {/* Score bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-slate-800 rounded h-1.5" />
        <div className="bg-slate-800 rounded h-3.5 w-6" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run skeleton test — should pass now**

```bash
cd nichesurage && npx jest src/components/niche/NicheCard.test.tsx --no-coverage -t "skeleton"
```

Expected: PASS (skeleton test passes, other two still fail due to missing NicheCard)

- [ ] **Step 3: Commit NicheCardSkeleton**

```bash
git add nichesurage/src/components/niche/NicheCardSkeleton.tsx
git commit -m "feat: add NicheCardSkeleton loading placeholder"
```

---

### Task 6: NicheCard orchestrator

**Files:**
- Create: `src/components/niche/NicheCard.tsx`

- [ ] **Step 1: Implement NicheCard**

Rules:
- `locked = userTier === 'free'`
- `channelName` is optional → if undefined (free tier), pass `—` to LockedField; if defined, render as `<a>` (basic+)
- `viralityRating` is always present in data → blur it for free users
- `engagementRate` is optional → omit badge entirely if undefined (free tier)
- Lock icon `🔒` shown only when `locked === true`
- `nicheLabel` shown below channel name only for basic+ (it is undefined for free users)
- MEGA spike: `spikeMultiplier >= 5` handled inside SpikeIndicator

```tsx
// src/components/niche/NicheCard.tsx
import { NicheCardData, UserTier } from '@/lib/types'
import { LockedField } from './LockedField'
import { SpikeIndicator } from './SpikeIndicator'
import { ScoreBar } from './ScoreBar'

interface NicheCardProps {
  data: NicheCardData
  userTier: UserTier
  rank: number
}

const LANG_FLAG: Record<string, string> = { en: '🇬🇧', de: '🇩🇪' }

const VIRALITY_STYLE: Record<string, string> = {
  excellent: 'text-green-400',
  good: 'text-yellow-400',
  average: 'text-slate-400',
}

const VIRALITY_LABEL: Record<string, string> = {
  excellent: '✨ Excellent',
  good: '⭐ Good',
  average: '~ Average',
}

export function NicheCard({ data, userTier, rank }: NicheCardProps) {
  const locked = userTier === 'free'

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      {/* Header row */}
      <div className="flex justify-between items-start mb-2.5">
        <div className="flex-1 min-w-0 mr-3">
          <div className="text-slate-400 text-xs uppercase tracking-widest mb-0.5">
            NICHE #{rank}
          </div>
          <div className="flex items-center gap-1.5">
            <LockedField locked={locked}>
              {data.channelName ? (
                <a
                  href={data.channelUrl}
                  className="text-slate-200 text-sm font-semibold hover:text-indigo-300 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {data.channelName} ↗
                </a>
              ) : (
                <span className="text-slate-200 text-sm font-semibold">—</span>
              )}
            </LockedField>
            {locked && <span className="text-xs text-slate-500">🔒</span>}
          </div>
          {data.nicheLabel && (
            <div className="text-indigo-400 text-xs mt-0.5">{data.nicheLabel}</div>
          )}
        </div>
        <SpikeIndicator multiplier={data.spikeMultiplier} />
      </div>

      {/* Badge row */}
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs">
          📺 {data.videoCount} videos
        </span>
        <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs">
          👥 {data.subscriberRange}
        </span>
        <LockedField locked={locked}>
          <span className={`bg-slate-800 px-2 py-0.5 rounded-full text-xs ${VIRALITY_STYLE[data.viralityRating]}`}>
            {VIRALITY_LABEL[data.viralityRating]}
          </span>
        </LockedField>
        {data.engagementRate !== undefined && (
          <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs">
            📈 {data.engagementRate}% eng
          </span>
        )}
        <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs">
          {LANG_FLAG[data.language]} {data.language.toUpperCase()}
        </span>
      </div>

      {/* Score bar */}
      <ScoreBar score={data.opportunityScore} />
    </div>
  )
}
```

- [ ] **Step 2: Run all tests — all three must pass**

```bash
cd nichesurage && npx jest src/components/niche/NicheCard.test.tsx --no-coverage
```

Expected output:
```
PASS src/components/niche/NicheCard.test.tsx
  NicheCard
    ✓ free tier: blurred elements present, no channel link, no engagement badge, lock icon shown
    ✓ basic tier: channel name is a link, virality badge unblurred, engagement badge present
    ✓ skeleton: renders without errors, contains animate-pulse elements

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

- [ ] **Step 3: Run the full test suite to check for regressions**

```bash
cd nichesurage && npx jest --no-coverage
```

Expected: all existing tests pass alongside the new ones.

- [ ] **Step 4: Commit NicheCard**

```bash
git add nichesurage/src/components/niche/NicheCard.tsx
git commit -m "feat: add NicheCard orchestrator — all niche card tests green"
```

---

## Self-Review

**Spec coverage:**
- ✅ Free tier: `channelName`/`viralityRating` blurred, lock icon, tooltip, no click interaction
- ✅ Basic/Premium: channel link, nicheLabel, engagement badge, MEGA spike ≥ 5
- ✅ Skeleton: animate-pulse grey blocks
- ✅ LockedField: `locked=false` renders children directly, `locked=true` applies blur + title
- ✅ SpikeIndicator: two variants (≥5 MEGA, <5 plain text)
- ✅ ScoreBar: indigo→purple gradient, score% width, no mount animation
- ✅ 3 test cases covering all three card states
- ✅ `engagementRate` omitted (not blurred) when undefined

**Type consistency:**
- `NicheCardProps`: `data: NicheCardData`, `userTier: UserTier`, `rank: number` — consistent throughout
- `LockedFieldProps`: `locked: boolean`, `children: ReactNode`, `className?: string` — used correctly in NicheCard
- `SpikeIndicatorProps`: `multiplier: number` — matches usage `data.spikeMultiplier`
- `ScoreBarProps`: `score: number` — matches usage `data.opportunityScore`
- All imports use `@/lib/types` alias which maps to `src/lib/types` per jest.config.ts `moduleNameMapper`

**No placeholders:** All steps contain complete code.
