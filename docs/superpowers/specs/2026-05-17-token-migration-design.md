# Design Token Migration — NicheSurage Dashboard Surface

**Date:** 2026-05-17
**Status:** Design — pending user approval
**Scope:** `nichesurage/` — `tailwind.config.ts`, `src/app/globals.css`, all `src/**` components

---

## 1. Problem

DESIGN.md §4 documents a **target** Tailwind token API for the dashboard surface —
`bg-surface-raised`, `text-ink-muted`, `border-hairline-edge`, `text-on-accent`,
`text-ink-subtle`, `bg-canvas`, `*-accent-emerald` — and explicitly marks it as
not-yet-live ("They become live when Task 6 wires the tokens").

Current reality:

- The `marketing.*` and `premium.*` token groups **are** wired.
- The **dashboard surface tokens are not.** Components reach the same colors via
  three redundant legacy groups — `charcoal.*`, `carbon.*`, `slate.950` — all of
  which alias the identical `--color-bg-*` CSS variables.
- Components also lean heavily on Tailwind's **built-in `slate` palette** for text
  (`text-slate-100/300/400/500`) and on **built-in `emerald`** for accents
  (`emerald-300/400/500`).
- Three CSS variables named in the DESIGN.md frontmatter do not exist in
  `globals.css`: `--color-ink-muted` (#a8acbb), `--color-ink-subtle` (#6b7081),
  `--color-on-accent` (#04140d).

Survey numbers: ~470 occurrences of legacy surface classes across 59 files; ~133
occurrences of `emerald` / built-in `slate` text / raw-hex classes across 42 files.

This leaves DESIGN.md as a permanent "naming bridge" (DESIGN.md line 149) rather than
a source of truth, and forces every future contributor — human or AI agent — to
translate between two vocabularies.

## 2. Goal

Make the DESIGN.md dashboard token API the **single, live vocabulary**. After this
migration:

- `tailwind.config.ts` exposes `surface.*`, `ink.*`, `hairline.*`, `accent.*`,
  `canvas`, `on-accent` — all pointing at existing CSS variables.
- No component references `charcoal-*`, `carbon-*`, `slate.950`, the built-in
  `slate` palette for UI color, or built-in `emerald` for the brand accent.
- The legacy `charcoal` / `carbon` / `slate` color groups are removed from
  `tailwind.config.ts`.
- DESIGN.md §4's "Token API status" caveat can be deleted — the API is live.

**Out of scope:** the `marketing.*` and `premium.*` token groups (already correct);
DESIGN.md's frontmatter and prose (already describe the target — only the §4 status
note changes); any visual redesign. This is a vocabulary migration, not a restyle.
Small, deliberate color shifts caused by palette consolidation (see §4) are accepted.

## 3. Approach

A **phased migration to a single vocabulary**, not a single big-bang diff and not a
permanent alias layer.

Rejected alternatives:

- **Big-bang one commit** — 470 edits across 59 files in one diff is unreviewable
  and high-risk; violates the project's phase-by-phase workflow (CLAUDE.md).
- **Permanent alias** (keep legacy groups forever pointing at the same vars) —
  defeats the purpose; DESIGN.md stays a translation layer indefinitely and a
  half-`slate-400`/half-`ink-muted` codebase looks *less* consistent than today.

The destination is "legacy names gone." The path is incremental: a zero-risk
config-wiring phase first, then component migration grouped by route/surface, then a
cleanup phase that removes the legacy groups once `grep` confirms zero usages.

## 4. Token mapping

New Tailwind tokens point at **existing** CSS variables wherever they exist —
DESIGN.md §2 forbids renaming the live CSS vars; we only add the three missing ones.

### 4.1 New CSS variables (added to `:root` in `globals.css`)

```css
--color-ink-muted:  #a8acbb;
--color-ink-subtle: #6b7081;
--color-on-accent:  #04140d;
```

### 4.2 New Tailwind color groups (`tailwind.config.ts`)

| Token | CSS var | Notes |
|---|---|---|
| `canvas` | `var(--color-bg-base)` | existing var |
| `surface.raised` | `var(--color-bg-raised)` | existing var |
| `surface.elevated` | `var(--color-bg-elevated)` | existing var |
| `surface.overlay` | `var(--color-bg-overlay)` | existing var |
| `surface.hover` | `var(--color-bg-hover)` | existing var |
| `ink.DEFAULT` | `var(--foreground)` | existing var; enables `text-ink` |
| `ink.muted` | `var(--color-ink-muted)` | new var |
| `ink.subtle` | `var(--color-ink-subtle)` | new var |
| `hairline.soft` | `var(--color-border-soft)` | existing var |
| `hairline.edge` | `var(--color-border-edge)` | existing var |
| `accent.emerald` | `var(--color-accent-emerald)` | existing var |
| `accent.emerald-bright` | `var(--color-accent-emerald-bright)` | existing var |
| `on-accent` | `var(--color-on-accent)` | new var |

### 4.3 Class translation table (legacy → new)

**Surfaces (background):**

| Legacy | New |
|---|---|
| `bg-slate-950` / `bg-carbon-950` / `bg-charcoal-950` | `bg-canvas` |
| `bg-charcoal-900` / `bg-carbon-900` | `bg-surface-raised` |
| `bg-charcoal-800` / `bg-carbon-800` | `bg-surface-elevated` |
| `bg-charcoal-700` / `bg-carbon-700` | `bg-surface-overlay` |
| `bg-charcoal-600` / `bg-carbon-600` | `bg-surface-hover` |

**Text (ink):**

| Legacy | New |
|---|---|
| `text-white` / `text-slate-100` / `text-slate-200` (UI text) | `text-ink` |
| `text-slate-300` / `text-slate-400` | `text-ink-muted` |
| `text-slate-500` / `text-slate-600` | `text-ink-subtle` |

**Accent (emerald):**

| Legacy | New |
|---|---|
| `*-emerald-500` (#10b981) | `*-accent-emerald` |
| `*-emerald-400` / `*-emerald-300` | `*-accent-emerald-bright` |

**Borders:**

| Legacy | New |
|---|---|
| `border-white/5` | `border-hairline-soft` |
| `border-white/8` / `border-white/10` | `border-hairline-edge` |
| solid `border-slate-600/700/800` | `border-hairline-edge` (DESIGN.md §7: no solid 20–50% white borders) |

### 4.4 Judgment cases (deliberate, not mechanical)

These shifts are intentional consequences of consolidating a wide built-in palette
into a constrained token set. Each is caught by the per-phase visual check.

1. **`text-slate-300` (#cbd5e1) → `ink-muted` (#a8acbb)** — secondary text becomes
   slightly darker / grayer. Intended (DESIGN.md constrains to 3 ink levels). Visual
   check confirms nothing critical becomes hard to read.
2. **`bg-slate-800` (#1e293b, bluish Tailwind default) → `surface-overlay`
   (#1b1d27)** — chip/pill backgrounds shift to the neutral surface scale.
3. **Solid `border-slate-700` → `hairline-edge`** — a visible mid-gray border
   becomes a faint 8%-white hairline. This is a DESIGN.md §7 correction, not a
   regression — flag in the phase commit so it is a conscious change.
4. **`text-charcoal-900` on white buttons** (Button primary/hero) → keep the white
   background; map the dark text token to `text-surface-raised` (same #0f1016). The
   white CTA button is intentional landing styling, not a surface.
5. **Raw hex (`bg-[#…]`, `text-[#…]`) and inline `rgba(16,185,129,…)` shadows** —
   migrated case-by-case to the nearest token. Where a value has no token equivalent
   (e.g. one-off glow alpha), it stays inline; note it in the phase commit.

When a legacy class has no clean target (an off-scale color, a one-off), the
implementer stops and flags it rather than guessing — consistent with the project's
"ask before big decisions" convention.

## 5. Phasing

Seven phases. Phases 2–6 each end with `tsc --noEmit` → `jest` → visual smoke check
→ focused `git add` (never `git add -A`) → commit, per CLAUDE.md.

| Phase | Scope | Risk |
|---|---|---|
| 1 — Config wiring | `globals.css` (+3 vars), `tailwind.config.ts` (new groups). Legacy groups untouched. Nothing consumes new tokens yet. | None — purely additive |
| 2 — Shared `ui/` primitives | `Button`, `Badge`, `EmptyState`, `SonarEmptyState`, `CookieBanner` | Low; migrated first so changes propagate |
| 3 — Nav + app shell | `TopNav`, `LandingNav`, `UserAvatarMenu`, `app/layout`, `login/*`, `global-error`, `terms`, `privacy`, `dashboard/*` | Low |
| 4 — Niche components | `NicheCard`, `NicheCardLocked`, `NicheDetailModal` + headers/panels, `HealthCheck*`, `AIContentAngles`, `BottomSheet`, `Sparkline`, etc. (~20 files) | Medium — largest group, densest color use |
| 5 — Discover + admin | `discover/page`, `discover/niche/[id]/page`, `DiscoverSurfaceTabs`, `CategoryFilterChips`, `admin/page`, `admin/layout`, `admin/*` components | Low–medium |
| 6 — Landing | `HeroSection`, `HeroBackdrop`, `HeroStatsBar`, `FeaturesSection`, `FaqSection`, `PricingSection`, `TierMatrix`, `PainSolutionSection`, `TestimonialsSection`, `FinalCTASection`, `LiveTickerBar`, `LandingFooter`, `LanguageToggle`, `AppPreviewSection` (~14 files) | Low |
| 7 — Cleanup | Remove `charcoal` / `carbon` / `slate` color groups from `tailwind.config.ts`; `grep` to confirm zero legacy usages; full `tsc` + `jest` sweep; delete the DESIGN.md §4 "Token API status" caveat | Low — failure surfaces immediately as a Tailwind unknown-class / build error |

Phase ordering rationale: shared primitives first so their token usage is consistent
before dependents migrate; cleanup last so a missed file fails loudly (unknown
Tailwind class) instead of silently keeping a dead alias.

## 6. Verification

- **Per phase:** `npx tsc --noEmit` clean; `npx jest` green (324/324 baseline — no
  regressions); visual smoke check of the affected routes against pre-phase state.
- **Phase 7 gate:** `grep -rE "charcoal-|carbon-|slate-950|bg-slate-|text-slate-[0-9]|emerald-[0-9]" nichesurage/src` returns zero hits before the legacy groups are
  removed. After removal, a full production build (`npm run build`) must succeed —
  any surviving legacy class becomes a build-time unknown-utility error.
- **Tests referencing classes:** `PricingSection.test.tsx`, `UpsellModal.test.tsx`,
  `TrendingTopics.test.tsx`, `PainSolutionSection.test.tsx` are checked in their
  component's phase; if a test asserts on a legacy class name, update the assertion
  in the same commit.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Subtle color shift looks wrong somewhere | Per-phase visual smoke check; judgment cases (§4.4) reviewed explicitly |
| A legacy class is missed | Phase 7 `grep` gate + production build catches every survivor |
| Test asserts on a legacy class | Tests migrated in the same phase as their component |
| Off-scale raw hex has no token | Implementer flags it; stays inline if genuinely one-off |
| Tailwind `Config` type rejects nested color strings | Same pattern as existing `marketing.*` / `premium.*` groups — known-good |
