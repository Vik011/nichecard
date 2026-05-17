# Dashboard Token Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the DESIGN.md dashboard token vocabulary (`surface/ink/hairline/accent/canvas/on-accent`) the single live Tailwind API, and retire the legacy `charcoal`/`carbon`/`slate` color groups.

**Architecture:** Phase 1 wires new tokens additively (zero risk — nothing consumes them yet). Phases 2–7 migrate components route-group by route-group, each applying a fixed translation table. Phase 8 removes the legacy groups once a repo-wide grep confirms zero usages; a production build then fails loudly on any survivor.

**Tech Stack:** Next.js 14 (App Router), Tailwind CSS 3, TypeScript, Jest. Working dir for all commands: `nichesurage/`.

**Spec:** `docs/superpowers/specs/2026-05-17-token-migration-design.md`

---

## Shared Reference: Translation Table

Every component task applies this table. It is the ONLY transformation — apply it
literally, preserving any opacity modifier (`/80`), state prefix (`hover:`,
`focus:`, `focus-visible:`), and responsive prefix (`md:`, `lg:`) unchanged.

**Surfaces — background:**

| Legacy class (any prefix) | New class |
|---|---|
| `bg-slate-950` / `bg-carbon-950` / `bg-charcoal-950` | `bg-canvas` |
| `bg-charcoal-900` / `bg-carbon-900` | `bg-surface-raised` |
| `bg-charcoal-800` / `bg-carbon-800` | `bg-surface-elevated` |
| `bg-charcoal-700` / `bg-carbon-700` | `bg-surface-overlay` |
| `bg-charcoal-600` / `bg-carbon-600` | `bg-surface-hover` |
| `bg-slate-800` (Tailwind default) | `bg-surface-overlay` |
| `bg-slate-900` (Tailwind default) | `bg-surface-elevated` |

**Text — ink:**

| Legacy class | New class |
|---|---|
| `text-white` / `text-slate-100` / `text-slate-200` | `text-ink` |
| `text-slate-300` / `text-slate-400` | `text-ink-muted` |
| `text-slate-500` / `text-slate-600` | `text-ink-subtle` |

**Accent — emerald:**

| Legacy class | New class |
|---|---|
| `bg-emerald-500` / `text-emerald-500` / `border-emerald-500` / `ring-emerald-500` / `fill-emerald-500` / `stroke-emerald-500` | swap `emerald-500` → `accent-emerald` |
| `*-emerald-400` / `*-emerald-300` | swap → `accent-emerald-bright` |
| `*-emerald-600` | swap → `accent-emerald` (no darker token; nearest) |

**Borders:**

| Legacy class | New class |
|---|---|
| `border-white/5` | `border-hairline-soft` |
| `border-white/8` / `border-white/10` | `border-hairline-edge` |
| `border-slate-600` / `border-slate-700` / `border-slate-800` | `border-hairline-edge` |

**Charcoal-as-text on white backgrounds:**

| Legacy class | New class |
|---|---|
| `text-charcoal-900` / `text-carbon-900` | `text-surface-raised` (same #0f1016 — dark text on a white CTA) |

**OUT OF SCOPE — do NOT change these.** Functional status colors stay as Tailwind
built-ins: `blue-*`, `indigo-*`, `orange-*`, `green-*`, `yellow-*`, `red-*`,
`amber-*`, `purple-*`. Also leave `bg-white`, `text-black`, and `slate-100` *when
used as a near-white hover on a white button* (e.g. `hover:bg-slate-100` in
`Button.tsx` — see Task 2). When unsure whether a color is structural or functional,
leave it and flag it in the task's commit message.

**Judgment rule:** if a legacy class is off-scale (a raw hex `bg-[#abc123]`, an
inline `rgba(16,185,129,…)` shadow, a slate shade not in the table), map it to the
nearest token ONLY if the hex matches a token value exactly. Otherwise leave it
inline and list it in the commit message body. Never guess.

---

## Task 1: Wire the new tokens

**Files:**
- Modify: `nichesurage/src/app/globals.css:23-25`
- Modify: `nichesurage/tailwind.config.ts:29-30`

Purely additive. No component consumes these yet, so nothing renders differently.

- [ ] **Step 1: Add the three missing CSS variables to `globals.css`**

In `nichesurage/src/app/globals.css`, find the `/* Foreground */` block:

```css
  /* Foreground */
  --background: var(--color-bg-base);
  --foreground: #ededed;
```

Replace it with:

```css
  /* Foreground */
  --background: var(--color-bg-base);
  --foreground: #ededed;
  --color-ink-muted: #a8acbb;
  --color-ink-subtle: #6b7081;
  --color-on-accent: #04140d;
```

- [ ] **Step 2: Add the new color groups to `tailwind.config.ts`**

In `nichesurage/tailwind.config.ts`, the `theme.extend.colors` block ends the
`charcoal` group at line 29 and starts `marketing` at line 30. Insert the new
groups between them — after the closing `},` of `charcoal` and before `marketing: {`:

```ts
        canvas: "var(--color-bg-base)",
        surface: {
          raised: "var(--color-bg-raised)",
          elevated: "var(--color-bg-elevated)",
          overlay: "var(--color-bg-overlay)",
          hover: "var(--color-bg-hover)",
        },
        ink: {
          DEFAULT: "var(--foreground)",
          muted: "var(--color-ink-muted)",
          subtle: "var(--color-ink-subtle)",
        },
        hairline: {
          soft: "var(--color-border-soft)",
          edge: "var(--color-border-edge)",
        },
        accent: {
          emerald: "var(--color-accent-emerald)",
          "emerald-bright": "var(--color-accent-emerald-bright)",
        },
        "on-accent": "var(--color-on-accent)",
```

Do NOT modify or remove the existing `slate`, `carbon`, or `charcoal` groups.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors. (If `Config` rejects nested string color values, it is a TS
version issue — the existing `marketing`/`premium` groups use the identical shape,
so this is known-good.)

- [ ] **Step 4: Build to confirm the new utilities generate**

Run: `npx tailwindcss -i ./src/app/globals.css -o /tmp/tw-check.css --content "./src/app/**/*.tsx" 2>&1 | tail -5`
Alternative if that flag set is unavailable: `npm run build`
Expected: completes without "unknown utility" errors.

- [ ] **Step 5: Run the test suite (baseline unchanged)**

Run: `npx jest`
Expected: all tests pass (324/324 baseline). No test depends on the new tokens yet.

- [ ] **Step 6: Commit**

```bash
git add nichesurage/src/app/globals.css nichesurage/tailwind.config.ts
git commit -m "feat(design): wire dashboard surface/ink/hairline/accent tokens"
```

---

## Task 2: Migrate shared `ui/` primitives

**Files (migrate each, applying the Translation Table):**
- Modify: `nichesurage/src/components/ui/Button.tsx`
- Modify: `nichesurage/src/components/ui/Badge.tsx`
- Modify: `nichesurage/src/components/ui/EmptyState.tsx`
- Modify: `nichesurage/src/components/ui/SonarEmptyState.tsx`
- Modify: `nichesurage/src/components/ui/CookieBanner.tsx`

These are migrated first because they are imported across the whole app.

- [ ] **Step 1: Migrate `Button.tsx`**

This is a judgment file. Apply these exact replacements in the `variants` object:

```ts
  const variants = {
    primary: 'bg-white text-surface-raised hover:bg-slate-100 shadow-[0_8px_16px_-2px_rgba(0,0,0,0.15)] hover:shadow-[0_12px_24px_-4px_rgba(0,0,0,0.2)]',
    ghost: 'bg-transparent border border-hairline-edge text-ink-muted hover:text-ink hover:border-hairline-edge',
    hero: 'bg-white text-surface-raised hover:bg-slate-100 shadow-[0_12px_28px_-4px_rgba(0,0,0,0.25)] hover:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.3)]',
  }
```

Notes: `bg-white` stays (white CTA, intentional). `hover:bg-slate-100` stays — it is
a near-white hover on a white button, no token equivalent (out-of-scope rule).
`text-charcoal-900` → `text-surface-raised`. `border-slate-800`/`border-slate-600`
→ `border-hairline-edge` (DESIGN.md §7: no solid mid-gray borders). `text-slate-400`
→ `text-ink-muted`, `text-slate-200` → `text-ink`.

- [ ] **Step 2: Migrate `Badge.tsx`**

Only the `slate` variants change. The `blue/indigo/orange/green/yellow` variants are
functional status colors — leave them. Apply:

```ts
    'tier-free': 'bg-surface-overlay text-ink-muted border border-hairline-edge',
    'virality-average': 'bg-transparent text-ink-muted',
    'lang': 'bg-surface-overlay text-ink-subtle',
```

Leave `tier-basic`, `tier-premium`, `spike`, `spike-mega`, `virality-excellent`,
`virality-good` exactly as they are.

- [ ] **Step 3: Migrate `EmptyState.tsx`, `SonarEmptyState.tsx`, `CookieBanner.tsx`**

For each file: read it, find every legacy class (`charcoal-*`, `carbon-*`,
`slate-*`, `emerald-[0-9]*`, `border-white/N`), and apply the Translation Table.
Leave functional status colors and out-of-scope classes untouched.

- [ ] **Step 4: Verify no legacy classes remain in these files**

Run: `npx rg -n "charcoal-|carbon-|slate-(50|100|200|300|400|500|600|700|800|900|950)|emerald-[0-9]|border-white/" src/components/ui/`
Expected: no output, EXCEPT the intentionally-kept `hover:bg-slate-100` lines in
`Button.tsx`. Confirm each remaining hit is a documented out-of-scope keep.

- [ ] **Step 5: Type-check and test**

Run: `npx tsc --noEmit`
Expected: zero errors.
Run: `npx jest`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add nichesurage/src/components/ui/Button.tsx nichesurage/src/components/ui/Badge.tsx nichesurage/src/components/ui/EmptyState.tsx nichesurage/src/components/ui/SonarEmptyState.tsx nichesurage/src/components/ui/CookieBanner.tsx
git commit -m "refactor(design): migrate ui/ primitives to semantic tokens

Kept hover:bg-slate-100 in Button.tsx (near-white hover on white CTA,
no token equivalent)."
```

---

## Task 3: Migrate nav + app shell

**Files (migrate each, applying the Translation Table):**
- Modify: `nichesurage/src/components/nav/TopNav.tsx`
- Modify: `nichesurage/src/components/landing/LandingNav.tsx`
- Modify: `nichesurage/src/components/user/UserAvatarMenu.tsx`
- Modify: `nichesurage/src/app/layout.tsx`
- Modify: `nichesurage/src/app/login/page.tsx`
- Modify: `nichesurage/src/app/login/LoginForm.tsx`
- Modify: `nichesurage/src/app/global-error.tsx`
- Modify: `nichesurage/src/app/terms/page.tsx`
- Modify: `nichesurage/src/app/privacy/page.tsx`
- Modify: `nichesurage/src/app/dashboard/page.tsx`
- Modify: `nichesurage/src/app/dashboard/ManageSubscriptionButton.tsx`

- [ ] **Step 1: Migrate each file**

For each file in the list: read it, find every legacy class, apply the Translation
Table. The DESIGN.md §4 nav target is `bg-canvas/80 backdrop-blur-md
border-b border-hairline-edge` — if `TopNav`/`LandingNav` already use a translucent
canvas (`bg-*-950/80`), the table maps it to `bg-canvas/80` and preserves the `/80`.

- [ ] **Step 2: Verify no legacy classes remain**

Run: `npx rg -n "charcoal-|carbon-|slate-(50|100|200|300|400|500|600|700|800|900|950)|emerald-[0-9]|border-white/" src/components/nav/ src/components/landing/LandingNav.tsx src/components/user/ src/app/layout.tsx src/app/login/ src/app/global-error.tsx src/app/terms/ src/app/privacy/ src/app/dashboard/`
Expected: no output. Any remaining hit must be a documented out-of-scope keep.

- [ ] **Step 3: Type-check and test**

Run: `npx tsc --noEmit` → zero errors.
Run: `npx jest` → all tests pass.

- [ ] **Step 4: Commit**

```bash
git add nichesurage/src/components/nav/TopNav.tsx nichesurage/src/components/landing/LandingNav.tsx nichesurage/src/components/user/UserAvatarMenu.tsx nichesurage/src/app/layout.tsx nichesurage/src/app/login/page.tsx nichesurage/src/app/login/LoginForm.tsx nichesurage/src/app/global-error.tsx nichesurage/src/app/terms/page.tsx nichesurage/src/app/privacy/page.tsx nichesurage/src/app/dashboard/page.tsx nichesurage/src/app/dashboard/ManageSubscriptionButton.tsx
git commit -m "refactor(design): migrate nav + app shell to semantic tokens"
```

---

## Task 4: Migrate niche core components

**Files (migrate each, applying the Translation Table):**
- Modify: `nichesurage/src/components/niche/NicheCard.tsx`
- Modify: `nichesurage/src/components/dashboard/NicheCardLocked.tsx`
- Modify: `nichesurage/src/components/niche/NicheDetailModal.tsx`
- Modify: `nichesurage/src/components/niche/NicheDetailHeader.tsx`
- Modify: `nichesurage/src/components/niche/NicheStatsPanel.tsx`
- Modify: `nichesurage/src/components/niche/BottomSheet.tsx`
- Modify: `nichesurage/src/components/niche/BookmarkButton.tsx`
- Modify: `nichesurage/src/components/niche/RevealCountdown.tsx`
- Modify: `nichesurage/src/components/niche/RelatedNiches.tsx`
- Modify: `nichesurage/src/components/niche/FreeDemoBanner.tsx`

- [ ] **Step 1: Migrate each file**

For each file: read it, find every legacy class, apply the Translation Table.
`NicheCard.tsx` is the densest file (`text-slate-100/300/400/500`, `bg-slate-800/70`
chips, `ring-emerald-500/30`, `text-emerald-300`, inline
`rgba(16,185,129,0.35)` shadow). Specifics for `NicheCard.tsx`:
- `text-slate-100` → `text-ink`; `text-slate-300`/`text-slate-400` → `text-ink-muted`;
  `text-slate-500` → `text-ink-subtle`.
- `bg-slate-800/70` → `bg-surface-overlay/70` (preserve the `/70`).
- `text-emerald-300` → `text-accent-emerald-bright`;
  `ring-emerald-500/30` → `ring-accent-emerald/30`.
- The inline `hover:shadow-[0_10px_28px_-14px_rgba(16,185,129,0.35)]` is an
  off-scale glow — leave it inline (out-of-scope rule); note it in the commit.

- [ ] **Step 2: Verify no legacy classes remain**

Run: `npx rg -n "charcoal-|carbon-|slate-(50|100|200|300|400|500|600|700|800|900|950)|emerald-[0-9]|border-white/" src/components/niche/NicheCard.tsx src/components/dashboard/NicheCardLocked.tsx src/components/niche/NicheDetailModal.tsx src/components/niche/NicheDetailHeader.tsx src/components/niche/NicheStatsPanel.tsx src/components/niche/BottomSheet.tsx src/components/niche/BookmarkButton.tsx src/components/niche/RevealCountdown.tsx src/components/niche/RelatedNiches.tsx src/components/niche/FreeDemoBanner.tsx`
Expected: no output. Any remaining hit must be a documented out-of-scope keep.

- [ ] **Step 3: Type-check and test**

Run: `npx tsc --noEmit` → zero errors.
Run: `npx jest` → all tests pass.

- [ ] **Step 4: Commit**

```bash
git add nichesurage/src/components/niche/NicheCard.tsx nichesurage/src/components/dashboard/NicheCardLocked.tsx nichesurage/src/components/niche/NicheDetailModal.tsx nichesurage/src/components/niche/NicheDetailHeader.tsx nichesurage/src/components/niche/NicheStatsPanel.tsx nichesurage/src/components/niche/BottomSheet.tsx nichesurage/src/components/niche/BookmarkButton.tsx nichesurage/src/components/niche/RevealCountdown.tsx nichesurage/src/components/niche/RelatedNiches.tsx nichesurage/src/components/niche/FreeDemoBanner.tsx
git commit -m "refactor(design): migrate niche core components to semantic tokens

Kept inline rgba(16,185,129,…) glow shadow in NicheCard.tsx
(off-scale, no token equivalent)."
```

---

## Task 5: Migrate niche panels + secondary components

**Files (migrate each, applying the Translation Table):**
- Modify: `nichesurage/src/components/niche/HealthCheckModal.tsx`
- Modify: `nichesurage/src/components/niche/HealthCheckButton.tsx`
- Modify: `nichesurage/src/components/niche/HealthCheckInline.tsx`
- Modify: `nichesurage/src/components/niche/AIContentAngles.tsx`
- Modify: `nichesurage/src/components/niche/AiQuotaExhausted.tsx`
- Modify: `nichesurage/src/components/niche/ChannelVideoGrid.tsx`
- Modify: `nichesurage/src/components/niche/PerformanceChart.tsx`
- Modify: `nichesurage/src/components/niche/Sparkline.tsx`
- Modify: `nichesurage/src/components/niche/TrendingTopics.tsx`
- Modify: `nichesurage/src/components/niche/TrendingTopics.test.tsx`
- Modify: `nichesurage/src/components/niche/UpsellModal.tsx`
- Modify: `nichesurage/src/components/niche/UpsellModal.test.tsx`

- [ ] **Step 1: Migrate each component file**

For each `.tsx` component: read it, find every legacy class, apply the Translation
Table. `PerformanceChart.tsx` and `Sparkline.tsx` may use SVG color props
(`fill-emerald-500`, `stroke-emerald-500`) — the accent rules cover `fill-*` and
`stroke-*` prefixes too. `UpsellModal.tsx` is on the marketing/premium surface — its
`marketing-*`/`premium-*` classes are already correct; only migrate any stray
`slate-*`/`charcoal-*`/`emerald-[0-9]` it still uses.

- [ ] **Step 2: Update the two test files**

Open `TrendingTopics.test.tsx` and `UpsellModal.test.tsx`. Search for any string
assertion on a legacy class name (e.g. `toHaveClass('text-slate-400')` or
`.toContain('emerald-500')`). If found, update the asserted string to the migrated
class name so the test matches the migrated component. If no class-name assertions
exist, leave the test files unchanged.

- [ ] **Step 3: Verify no legacy classes remain**

Run: `npx rg -n "charcoal-|carbon-|slate-(50|100|200|300|400|500|600|700|800|900|950)|emerald-[0-9]|border-white/" src/components/niche/HealthCheckModal.tsx src/components/niche/HealthCheckButton.tsx src/components/niche/HealthCheckInline.tsx src/components/niche/AIContentAngles.tsx src/components/niche/AiQuotaExhausted.tsx src/components/niche/ChannelVideoGrid.tsx src/components/niche/PerformanceChart.tsx src/components/niche/Sparkline.tsx src/components/niche/TrendingTopics.tsx src/components/niche/UpsellModal.tsx`
Expected: no output. Any remaining hit must be a documented out-of-scope keep.

- [ ] **Step 4: Type-check and test**

Run: `npx tsc --noEmit` → zero errors.
Run: `npx jest` → all tests pass (including the two updated test files).

- [ ] **Step 5: Commit**

```bash
git add nichesurage/src/components/niche/HealthCheckModal.tsx nichesurage/src/components/niche/HealthCheckButton.tsx nichesurage/src/components/niche/HealthCheckInline.tsx nichesurage/src/components/niche/AIContentAngles.tsx nichesurage/src/components/niche/AiQuotaExhausted.tsx nichesurage/src/components/niche/ChannelVideoGrid.tsx nichesurage/src/components/niche/PerformanceChart.tsx nichesurage/src/components/niche/Sparkline.tsx nichesurage/src/components/niche/TrendingTopics.tsx nichesurage/src/components/niche/TrendingTopics.test.tsx nichesurage/src/components/niche/UpsellModal.tsx nichesurage/src/components/niche/UpsellModal.test.tsx
git commit -m "refactor(design): migrate niche panels + secondary components to semantic tokens"
```

---

## Task 6: Migrate discover + admin

**Files (migrate each, applying the Translation Table):**
- Modify: `nichesurage/src/app/discover/page.tsx`
- Modify: `nichesurage/src/app/discover/niche/[id]/page.tsx`
- Modify: `nichesurage/src/components/niche/DiscoverSurfaceTabs.tsx`
- Modify: `nichesurage/src/components/niche/CategoryFilterChips.tsx`
- Modify: `nichesurage/src/app/admin/page.tsx`
- Modify: `nichesurage/src/app/admin/layout.tsx`
- Modify: `nichesurage/src/components/admin/StatCard.tsx`
- Modify: `nichesurage/src/components/admin/AdminSignOut.tsx`

- [ ] **Step 1: Migrate each file**

For each file: read it, find every legacy class, apply the Translation Table.

- [ ] **Step 2: Verify no legacy classes remain**

Run: `npx rg -n "charcoal-|carbon-|slate-(50|100|200|300|400|500|600|700|800|900|950)|emerald-[0-9]|border-white/" src/app/discover/ src/components/niche/DiscoverSurfaceTabs.tsx src/components/niche/CategoryFilterChips.tsx src/app/admin/ src/components/admin/`
Expected: no output. Any remaining hit must be a documented out-of-scope keep.

- [ ] **Step 3: Type-check and test**

Run: `npx tsc --noEmit` → zero errors.
Run: `npx jest` → all tests pass.

- [ ] **Step 4: Commit**

```bash
git add nichesurage/src/app/discover/page.tsx "nichesurage/src/app/discover/niche/[id]/page.tsx" nichesurage/src/components/niche/DiscoverSurfaceTabs.tsx nichesurage/src/components/niche/CategoryFilterChips.tsx nichesurage/src/app/admin/page.tsx nichesurage/src/app/admin/layout.tsx nichesurage/src/components/admin/StatCard.tsx nichesurage/src/components/admin/AdminSignOut.tsx
git commit -m "refactor(design): migrate discover + admin to semantic tokens"
```

---

## Task 7: Migrate landing components

**Files (migrate each, applying the Translation Table):**
- Modify: `nichesurage/src/components/landing/LandingPage.tsx`
- Modify: `nichesurage/src/components/landing/HeroSection.tsx`
- Modify: `nichesurage/src/components/landing/HeroBackdrop.tsx`
- Modify: `nichesurage/src/components/landing/HeroStatsBar.tsx`
- Modify: `nichesurage/src/components/landing/FeaturesSection.tsx`
- Modify: `nichesurage/src/components/landing/FaqSection.tsx`
- Modify: `nichesurage/src/components/landing/PricingSection.tsx`
- Modify: `nichesurage/src/components/landing/PricingSection.test.tsx`
- Modify: `nichesurage/src/components/landing/TierMatrix.tsx`
- Modify: `nichesurage/src/components/landing/PainSolutionSection.tsx`
- Modify: `nichesurage/src/components/landing/PainSolutionSection.test.tsx`
- Modify: `nichesurage/src/components/landing/TestimonialsSection.tsx`
- Modify: `nichesurage/src/components/landing/FinalCTASection.tsx`
- Modify: `nichesurage/src/components/landing/LiveTickerBar.tsx`
- Modify: `nichesurage/src/components/landing/LandingFooter.tsx`
- Modify: `nichesurage/src/components/landing/LanguageToggle.tsx`
- Modify: `nichesurage/src/components/landing/AppPreviewSection.tsx`

`LandingNav.tsx` was already migrated in Task 3 — do not touch it here.

- [ ] **Step 1: Migrate each component file**

For each `.tsx` component: read it, find every legacy class, apply the Translation
Table. Landing components are on the marketing surface — `marketing-*` classes are
already correct; only migrate stray `slate-*`/`charcoal-*`/`carbon-*`/`emerald-[0-9]`
and legacy borders.

- [ ] **Step 2: Update the two test files**

Open `PricingSection.test.tsx` and `PainSolutionSection.test.tsx`. Search for any
string assertion on a legacy class name. If found, update the asserted string to the
migrated class name. If none exist, leave the file unchanged.

- [ ] **Step 3: Verify no legacy classes remain**

Run: `npx rg -n "charcoal-|carbon-|slate-(50|100|200|300|400|500|600|700|800|900|950)|emerald-[0-9]|border-white/" src/components/landing/`
Expected: no output. Any remaining hit must be a documented out-of-scope keep.

- [ ] **Step 4: Type-check and test**

Run: `npx tsc --noEmit` → zero errors.
Run: `npx jest` → all tests pass (including the two updated test files).

- [ ] **Step 5: Commit**

```bash
git add nichesurage/src/components/landing/
git commit -m "refactor(design): migrate landing components to semantic tokens"
```

(`git add` of the `landing/` directory is acceptable here because every file in it
is part of this task — this is not a `git add -A`.)

---

## Task 8: Remove legacy color groups + cleanup

**Files:**
- Modify: `nichesurage/tailwind.config.ts:14-29`
- Modify: `nichesurage/DESIGN.md` (delete the §4 "Token API status" caveat)

- [ ] **Step 1: Repo-wide grep gate — confirm zero legacy usages**

Run: `npx rg -n "charcoal-|carbon-|slate-(50|100|200|300|400|500|600|700|800|900|950)|bg-slate-9|emerald-[0-9]" src/`
Expected: ONLY the documented out-of-scope keeps surface — currently the
`hover:bg-slate-100` lines in `Button.tsx`. If any OTHER hit appears, a file was
missed: migrate it (apply the Translation Table), commit it with message
`refactor(design): migrate missed <file> to semantic tokens`, then re-run this step.

- [ ] **Step 2: Remove the legacy color groups from `tailwind.config.ts`**

Delete the `slate`, `carbon`, and `charcoal` color group blocks (currently lines
14–29). Keep `background`, `foreground`, and every group added in Task 1
(`canvas`, `surface`, `ink`, `hairline`, `accent`, `on-accent`) plus `marketing` and
`premium`. After the edit, `theme.extend.colors` opens directly with `background`
and `foreground`, then the Task 1 groups.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Production build — sanity check**

Run: `npm run build`
Expected: build succeeds. Note: removing the color groups does NOT make the build
fail on a missed legacy class — Tailwind simply stops generating that utility, so
the element silently loses its color. The grep gate in Step 1 is therefore the real
safety net; this build step only confirms nothing else broke. If the build fails,
read the error, fix the referenced file, commit, re-run.

- [ ] **Step 5: Run the full test suite**

Run: `npx jest`
Expected: all tests pass (324/324 baseline).

- [ ] **Step 6: Delete the DESIGN.md §4 "Token API status" caveat**

In `nichesurage/DESIGN.md`, find the blockquote under `## 4. Component Stylings`
that begins `> **Token API status:**` and ends `…(no big-bang refactor).` Delete the
entire blockquote — the token API is now live, so the caveat is obsolete. Leave the
rest of §4 unchanged.

- [ ] **Step 7: Commit**

```bash
git add nichesurage/tailwind.config.ts nichesurage/DESIGN.md
git commit -m "refactor(design): remove legacy charcoal/carbon/slate color groups

Token migration complete — DESIGN.md dashboard token API is now the
single live vocabulary. Drops the obsolete §4 Token API status caveat."
```

---

## Verification (whole-plan, after Task 8)

- [ ] `npx tsc --noEmit` clean.
- [ ] `npx jest` green — 324/324, no regressions vs. baseline.
- [ ] `npm run build` succeeds.
- [ ] `npx rg "charcoal-|carbon-|slate-(100|200|300|400|500|600|700|800|900|950)|emerald-[0-9]" src/` returns only the documented `Button.tsx` `hover:bg-slate-100` keeps.
- [ ] Visual smoke (human reviewer or screenshot probe): `/`, `/discover`, `/pricing`,
  a niche detail modal, `/admin` render with no obvious color regression vs. production.
  Expect only the deliberate shifts documented in spec §4.4.

---

## Notes for the executor

- Each task is one route-group; subagent-driven execution dispatches one fresh
  subagent per task. Review between tasks per project convention.
- The migration is class-rename only — never change layout, spacing, structure, or
  functional status colors.
- When a class is genuinely ambiguous, the executor stops and flags it rather than
  guessing (project convention: ask before non-trivial decisions).
- Visual verification per spec §4.4 cannot be done by `tsc`/`jest` — it is a
  human-reviewer checkpoint between tasks, or an HTTP/screenshot probe.
