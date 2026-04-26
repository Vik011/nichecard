# NicheCard Components — Design Spec

**Date:** 2026-04-27  
**Task:** Task 7 — NicheCard components  
**Status:** Approved

---

## Overview

Build a set of composed React components that display YouTube niche opportunity data. Cards are the core UI element of the NicheSurage dashboard. The design uses a compact layout with tier-based data gating — free users see blurred/locked fields, basic and premium users see everything.

UI language is English. Content language (EN/DE niches) is indicated via a badge on each card.

---

## Visual Design

**Layout:** Compact horizontal card — all data in one view, badge row, score progress bar. Shows more cards per screen than richer alternatives.

**Three states:**

1. **Free tier** — `channelName` and `viralityRating` rendered with CSS `blur(5px)`. A 🔒 icon appears next to the channel name. Hovering any blurred element shows a native `title` tooltip: `"Upgrade to Basic to unlock"`. No click interaction beyond the tooltip.

2. **Basic / Premium** — All fields visible. `channelName` renders as a clickable link (`channelUrl`), labeled with `nicheLabel` below. High spikes (≥ 5×) get a MEGA badge (orange bordered box). `engagementRate` badge appears in the badge row.

3. **Loading skeleton** — Grey placeholder blocks matching the card layout. Shimmer animation via Tailwind `animate-pulse`.

**Spike threshold for MEGA:** `spikeMultiplier >= 5` → MEGA variant (orange box with border). Below 5 → plain orange text badge.

---

## Component Architecture

```
src/components/niche/
├── NicheCard.tsx
├── NicheCard.test.tsx
├── LockedField.tsx
├── SpikeIndicator.tsx
├── ScoreBar.tsx
└── NicheCardSkeleton.tsx
```

### NicheCard

Orchestrator. Receives data and user tier, delegates rendering to sub-components.

```ts
interface NicheCardProps {
  data: NicheCardData
  userTier: UserTier
  rank: number
}
```

Determines `locked = userTier === 'free'` and passes it down to `LockedField` wrappers around gated fields.

**Gated fields (locked for free tier):**
- `channelName` / `channelUrl` / `nicheLabel`
- `viralityRating`
- `engagementRate`

**Always visible (all tiers):**
- `rank` (passed as prop)
- `videoCount`
- `subscriberRange`
- `spikeMultiplier`
- `opportunityScore`
- `language`

### LockedField

Reusable blur wrapper. Renders children normally when `locked=false`, applies `filter: blur(5px)` and `title` tooltip when `locked=true`.

```ts
interface LockedFieldProps {
  locked: boolean
  children: ReactNode
  className?: string
}
```

No click handlers — blur is purely visual. The tooltip is the only affordance for free users.

**Important:** For free users, the optional fields (`channelName`, `viralityRating`, `engagementRate`) are `undefined` in `NicheCardData`. `NicheCard` is responsible for passing placeholder content to `LockedField` in that case — a short dash (`—`) for text fields and a generic "Excellent" string for the virality badge. `LockedField` just applies the blur regardless of what children it receives. `engagementRate` badge is omitted entirely (not blurred) when the value is undefined.

### SpikeIndicator

Displays the spike multiplier. Two visual variants driven by a single `multiplier` prop:

- `multiplier >= 5` → MEGA: orange bordered box with "MEGA" label below the number
- `multiplier < 5` → plain orange text badge inline with the header

```ts
interface SpikeIndicatorProps {
  multiplier: number
}
```

### ScoreBar

Gradient progress bar (indigo → purple) showing `opportunityScore` (0–100). Score number displayed to the right of the bar.

```ts
interface ScoreBarProps {
  score: number
}
```

Bar width: `${score}%`. No animation on mount.

### NicheCardSkeleton

Stateless loading placeholder. Same layout as NicheCard but all content replaced with `animate-pulse` grey blocks. No props.

---

## Data Flow

```
Dashboard page
  └── NicheCard (data: NicheCardData, userTier: UserTier, rank: number)
        ├── LockedField (locked: boolean)   ← wraps channelName, viralityRating, engagementRate
        ├── SpikeIndicator (multiplier)
        └── ScoreBar (score)
```

The parent page is responsible for fetching data and passing `userTier`. NicheCard has no data-fetching logic.

---

## Testing

File: `src/components/niche/NicheCard.test.tsx`

Three test cases using `@testing-library/react`:

1. **Free tier** — blurred elements have `style="filter: blur(...)"`, channel name link is not rendered, engagement rate badge is not rendered.
2. **Basic tier** — channel name renders as an `<a>` tag with correct href, virality rating is visible, engagement rate badge present.
3. **Skeleton** — `NicheCardSkeleton` renders without errors, contains pulse placeholder elements.

---

## File Additions

| File | Purpose |
|------|---------|
| `src/components/niche/NicheCard.tsx` | Main card orchestrator |
| `src/components/niche/NicheCard.test.tsx` | Tests for all 3 states |
| `src/components/niche/LockedField.tsx` | Reusable blur/lock wrapper |
| `src/components/niche/SpikeIndicator.tsx` | Spike multiplier badge (normal + MEGA) |
| `src/components/niche/ScoreBar.tsx` | Opportunity score progress bar |
| `src/components/niche/NicheCardSkeleton.tsx` | Loading skeleton |

No changes to existing files. No new dependencies required.
