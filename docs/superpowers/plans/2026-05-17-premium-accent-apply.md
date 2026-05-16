# Premium Accent Live Apply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply DESIGN.md §Premium-tier accent (indigo + gold) to the two upsell surfaces with a live use case, UpsellModal and the PricingSection Premium card, at production-polish quality.

**Architecture:** Pure presentation change. Two React components get tier-aware styling. A token revision and two hover-glow utility classes are added to the design system. No logic, routing, Stripe, or gating change.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Tailwind CSS, CSS custom properties, Jest + React Testing Library.

**Working directory:** All paths below are relative to `nichesurage/` unless they start with `docs/`. Branch: `feat/premium-accent`.

**Reference spec:** `docs/superpowers/specs/2026-05-17-premium-accent-apply-design.md`

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/app/globals.css` | Design tokens + utility classes | Revise `--premium-gold`; add 2 glow utilities |
| `nichesurage/DESIGN.md` | Design system source of truth | Revise `premium-gold` hex |
| `docs/design/preview.html` | Visual token catalog | Revise gold swatch hex |
| `src/components/landing/copy.ts` | Bilingual UI copy | Add `pricingPremiumTrust` key (en + de) |
| `src/components/niche/UpsellModal.tsx` | Paywall upsell modal | Tier-aware accent |
| `src/components/niche/UpsellModal.test.tsx` | New test file | Tier-aware behavior |
| `src/components/landing/PricingSection.tsx` | Landing pricing cards | Premium card gilded treatment + trust line |
| `src/components/landing/PricingSection.test.tsx` | Existing test file | Update 1 test, add 2 tests |

**Note on `--premium-gold` and Tailwind:** `tailwind.config.ts` defines `premium.gold` as `"var(--premium-gold)"`. It references the CSS variable, so revising the variable in `globals.css` propagates to Tailwind automatically. `tailwind.config.ts` needs NO edit.

---

## Task 1: Token revision + glow utility classes

**Files:**
- Modify: `src/app/globals.css` (`:root` line 47, and append after line 269)
- Modify: `nichesurage/DESIGN.md`
- Modify: `docs/design/preview.html`

- [ ] **Step 1: Revise the `--premium-gold` token in globals.css**

In `src/app/globals.css`, line 47 currently reads:

```css
  --premium-gold: #cbb275;
```

Change it to (a softer, ~12% less saturated gold, approved during brainstorming):

```css
  --premium-gold: #c3b088;
```

Leave `--premium-gold-bright` (`#e2c989`) and `--premium-gold-muted` (`#8a7847`) unchanged: they remain the lighter and darker poles of the family.

- [ ] **Step 2: Append the two glow utility classes to globals.css**

`.marketing-hero-mesh` ends at line 269. Append the following AFTER it (plain classes, same pattern as `.marketing-hero-mesh`, not inside an `@layer`):

```css
/* Premium-tier hover glow. ~0.9s ambient glow on the Premium upsell
   surfaces. rgba(195,176,136,…) is --premium-gold (#c3b088); the box-shadow
   needs an alpha channel, which a hex var cannot supply, so it is inlined. */
.premium-modal-glow {
  box-shadow: 0 40px 90px -30px rgba(0, 0, 0, 0.85);
  transition: box-shadow 0.9s ease;
}
.premium-modal-glow:hover {
  box-shadow:
    0 40px 110px -28px rgba(0, 0, 0, 0.85),
    0 0 60px -8px rgba(94, 106, 210, 0.30),
    0 0 38px -10px rgba(195, 176, 136, 0.20);
}

.premium-card-glow {
  box-shadow: 0 34px 70px -34px rgba(0, 0, 0, 0.9);
  transition: box-shadow 0.9s ease;
}
.premium-card-glow:hover {
  box-shadow:
    0 34px 70px -32px rgba(0, 0, 0, 0.9),
    0 0 46px -12px rgba(195, 176, 136, 0.20);
}
```

- [ ] **Step 3: Revise `#cbb275` references in DESIGN.md**

Run: `grep -n "cbb275" nichesurage/DESIGN.md`
Expected: 2 matches (the `premium-gold` frontmatter token, and the §Premium-tier accent CTA prose).

Replace every `#cbb275` with `#c3b088` in `nichesurage/DESIGN.md`. Do NOT touch `#e2c989` or `#8a7847`.

- [ ] **Step 4: Revise the gold swatch in preview.html**

Run: `grep -n "cbb275" nichesurage/docs/design/preview.html`
Replace every `#cbb275` found with `#c3b088`. If `grep` returns no matches, skip this step (the catalog may key the swatch off the CSS variable already).

- [ ] **Step 5: Verify all sources agree**

Run: `grep -rn "cbb275" nichesurage/src nichesurage/DESIGN.md nichesurage/docs/design`
Expected: no output (zero matches). The old hex is fully gone.

Run: `cd nichesurage && npx tsc --noEmit`
Expected: no errors (CSS-only change, but confirms nothing else broke).

- [ ] **Step 6: Commit**

```bash
git add nichesurage/src/app/globals.css nichesurage/DESIGN.md nichesurage/docs/design/preview.html
git commit -m "$(cat <<'EOF'
feat(design): desaturate premium-gold token + add hover-glow utilities

Revises --premium-gold #cbb275 → #c3b088 (~12% less saturated, approved
in brainstorming) across globals.css, DESIGN.md, preview.html. Adds
.premium-modal-glow and .premium-card-glow utilities for the upcoming
Premium upsell surfaces.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Trust signal copy key

**Files:**
- Modify: `src/components/landing/copy.ts` (en block ~line 305, de block ~line 641)

- [ ] **Step 1: Add the key to the English copy block**

In `src/components/landing/copy.ts`, find this line inside the `en:` object:

```ts
    pricingCtaPremium: 'Go Premium',
```

Add a new line immediately after it:

```ts
    pricingCtaPremium: 'Go Premium',
    pricingPremiumTrust: 'Cancel anytime · Secure checkout via Stripe',
```

- [ ] **Step 2: Add the key to the German copy block**

Find this line inside the `de:` object:

```ts
    pricingCtaPremium: 'Premium holen',
```

Add a new line immediately after it:

```ts
    pricingCtaPremium: 'Premium holen',
    pricingPremiumTrust: 'Jederzeit kündbar · Sichere Zahlung über Stripe',
```

The separator is a middle dot (`·`, U+00B7), not a dash. No em-dash or en-dash in either string.

- [ ] **Step 3: Verify the type stays consistent**

`CopyKeys` is `typeof COPY[keyof typeof COPY]`. Adding the key to BOTH `en` and `de` keeps both union members in sync.

Run: `cd nichesurage && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add nichesurage/src/components/landing/copy.ts
git commit -m "$(cat <<'EOF'
feat(copy): add pricingPremiumTrust trust-signal string (en + de)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: UpsellModal tier-aware accent

**Files:**
- Create: `src/components/niche/UpsellModal.test.tsx`
- Modify: `src/components/niche/UpsellModal.tsx` (full rewrite of the component body)

- [ ] **Step 1: Write the failing test file**

Create `src/components/niche/UpsellModal.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { UpsellModal } from './UpsellModal'
import { COPY } from '@/components/landing/copy'

const copy = COPY.en

describe('UpsellModal', () => {
  it('renders nothing for premium tier', () => {
    const { container } = render(
      <UpsellModal tier="premium" copy={copy} onClose={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('basic→premium variant wears the Premium indigo + gold accent', () => {
    const { container } = render(
      <UpsellModal tier="basic" copy={copy} onClose={() => {}} />,
    )
    expect(
      container.querySelector('[class*="from-premium-canvas"]'),
    ).not.toBeNull()
    expect(screen.getByText(copy.upsellCtaBasic).closest('a')).toHaveClass(
      'bg-premium-gold',
    )
  })

  it('free→basic variant keeps the emerald glass accent, no premium tokens', () => {
    const { container } = render(
      <UpsellModal tier="free" copy={copy} onClose={() => {}} />,
    )
    expect(
      container.querySelector('[class*="ring-emerald-500"]'),
    ).not.toBeNull()
    expect(
      container.querySelector('[class*="from-premium-canvas"]'),
    ).toBeNull()
  })

  it('CTA links to the pricing section', () => {
    render(<UpsellModal tier="basic" copy={copy} onClose={() => {}} />)
    expect(screen.getByText(copy.upsellCtaBasic).closest('a')).toHaveAttribute(
      'href',
      '/#pricing',
    )
  })

  it('Escape key calls onClose', () => {
    const onClose = jest.fn()
    render(<UpsellModal tier="basic" copy={copy} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd nichesurage && npx jest src/components/niche/UpsellModal.test.tsx`
Expected: the `basic→premium variant` test FAILS (no element with `from-premium-canvas`; CTA still `bg-white`). The other tests may pass against the current component, that is fine.

- [ ] **Step 3: Rewrite UpsellModal.tsx with the tier-aware accent**

Replace the entire contents of `src/components/niche/UpsellModal.tsx` with:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { LockSimple, X } from '@phosphor-icons/react/dist/ssr'
import type { UserTier } from '@/lib/types'
import type { CopyKeys } from '@/components/landing/copy'

interface UpsellModalProps {
  /** Tier the current user is on. Determines which CTA we show. */
  tier: UserTier
  copy: CopyKeys
  onClose: () => void
}

// Sprint A.7 — opens when a FREE or BASIC user clicks a paywalled (blurred)
// niche card. We deliberately keep the user on /discover (modal, not nav)
// so the surrounding visible-but-locked cards continue to do their FOMO
// work behind the dialog. PREMIUM never sees this modal because their
// cards aren't paywalled.
export function UpsellModal({ tier, copy, onClose }: UpsellModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Escape closes; click outside the dialog also closes (handled by the
  // backdrop button below). Keeping the focus-trap minimal — full a11y
  // polish can come later, the priority right now is the conversion CTA.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // PREMIUM shouldn't ever reach this — guard rather than render an
  // empty/broken state.
  if (tier === 'premium') return null

  const isBasic = tier === 'basic'
  const title = isBasic ? copy.upsellTitleBasic : copy.upsellTitleFree
  const body = isBasic ? copy.upsellBodyBasic : copy.upsellBodyFree
  const ctaLabel = isBasic ? copy.upsellCtaBasic : copy.upsellCtaFree
  // Both CTAs route to the landing pricing section. There is no dedicated
  // /pricing page (was a 404 footgun before 2026-05-07); the canonical
  // pricing surface is the `#pricing` section on `/`.
  const ctaHref = '/#pricing'

  // Tier-aware accent. The basic→premium variant wears the Premium accent
  // (indigo canvas + gold, per DESIGN.md §Premium-tier accent). The
  // free→basic variant keeps the dashboard glass + emerald: indigo and gold
  // are reserved for the Premium tier, and free→basic targets Basic, whose
  // color is emerald. Both variants share the same polished structure
  // (wide soft shadow, stronger backdrop blur, quiet secondary button).
  const theme = isBasic
    ? {
        panel:
          'bg-gradient-to-b from-premium-canvas to-premium-canvas-deep premium-modal-glow',
        hairline: true,
        iconChip: 'bg-white/5 ring-1 ring-white/10',
        icon: 'text-premium-gold',
        title: 'text-premium-ink',
        body: 'text-premium-ink-muted',
        cta: 'bg-premium-gold text-premium-canvas-deep hover:bg-premium-gold-bright hover:-translate-y-px',
        secondary: 'text-premium-ink-muted/55 hover:text-premium-ink-muted',
      }
    : {
        panel:
          'glass ring-1 ring-emerald-500/30 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.7)]',
        hairline: false,
        iconChip: 'bg-emerald-500/10 ring-1 ring-emerald-500/30',
        icon: 'text-emerald-300',
        title: 'text-slate-100',
        body: 'text-slate-400',
        cta: 'bg-white text-charcoal-900 hover:bg-slate-100',
        secondary: 'text-slate-500 hover:text-slate-300',
      }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      {/* Backdrop — stronger blur than before so the modal reads as a
          focused, separate layer. */}
      <button
        type="button"
        aria-label="Close upsell"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
      />

      <div
        ref={dialogRef}
        className={`relative w-full max-w-md overflow-hidden rounded-2xl p-7 ${theme.panel}`}
      >
        {/* Gold hairline: the shared "exclusive layer" identity element.
            Only the Premium variant gets it. */}
        {theme.hairline && (
          <div
            aria-hidden
            className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-premium-gold/80 to-transparent"
          />
        )}

        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-500 hover:text-slate-200 transition-colors p-1.5"
        >
          <X weight="bold" size={16} aria-hidden />
        </button>

        <div
          className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 ${theme.iconChip}`}
        >
          <LockSimple
            weight="fill"
            size={20}
            className={theme.icon}
            aria-hidden
          />
        </div>

        <h2
          className={`text-xl font-semibold tracking-tight mb-2 ${theme.title}`}
        >
          {title}
        </h2>
        <p className={`text-sm leading-relaxed mb-6 ${theme.body}`}>{body}</p>

        <div className="flex flex-col gap-2">
          <Link
            href={ctaHref}
            className={`block w-full text-center py-3 px-4 rounded-xl font-semibold text-[15px] transition-all ${theme.cta}`}
          >
            {ctaLabel}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className={`text-[13px] py-2 transition-colors ${theme.secondary}`}
          >
            {copy.upsellSecondary}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd nichesurage && npx jest src/components/niche/UpsellModal.test.tsx`
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add nichesurage/src/components/niche/UpsellModal.tsx nichesurage/src/components/niche/UpsellModal.test.tsx
git commit -m "$(cat <<'EOF'
feat(upsell): tier-aware premium accent on UpsellModal

basic→premium variant gets the indigo canvas, gold hairline, gold CTA
and hover glow per DESIGN.md §Premium-tier accent. free→basic keeps the
emerald glass (gold/indigo are Premium-only). Both share the polished
structure: stronger backdrop blur, wider soft shadow, quieter secondary.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: PricingSection Premium card gilded treatment

**Files:**
- Modify: `src/components/landing/PricingSection.tsx`
- Modify: `src/components/landing/PricingSection.test.tsx`

- [ ] **Step 1: Update the existing test and add two new tests**

In `src/components/landing/PricingSection.test.tsx`, find this test (lines 62-66):

```tsx
  it('Premium tier card has glow glass class', () => {
    const { container } = render(<PricingSection copy={copy} />)
    const cards = container.querySelectorAll('[class*="glass-glow"]')
    expect(cards.length).toBeGreaterThan(0)
  })
```

Replace it with these three tests:

```tsx
  it('Premium tier card has the gilded glow class', () => {
    const { container } = render(<PricingSection copy={copy} />)
    const cards = container.querySelectorAll('[class*="premium-card-glow"]')
    expect(cards.length).toBeGreaterThan(0)
  })

  it('Premium CTA uses the gold fill', () => {
    render(<PricingSection copy={copy} />)
    expect(
      screen.getByText(copy.pricingCtaPremium).closest('a'),
    ).toHaveClass('bg-premium-gold')
  })

  it('Premium card shows the trust signal line', () => {
    render(<PricingSection copy={copy} />)
    expect(screen.getByText(copy.pricingPremiumTrust)).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `cd nichesurage && npx jest src/components/landing/PricingSection.test.tsx`
Expected: `Premium tier card has the gilded glow class`, `Premium CTA uses the gold fill`, and `Premium card shows the trust signal line` all FAIL. The other tests still PASS.

- [ ] **Step 3: Update the Premium card wrapper className**

In `src/components/landing/PricingSection.tsx`, the `MotionCard` className (lines 116-122) currently reads:

```tsx
                className={
                  tier.highlight
                    ? 'relative glass rounded-2xl p-8 ring-1 ring-emerald-500/30'
                    : tier.isPremium
                    ? 'relative glass glass-glow rounded-2xl p-8'
                    : 'relative gborder bg-charcoal-900 rounded-2xl p-8'
                }
```

Change the `tier.isPremium` branch (keep `tier.highlight` and the final branch unchanged):

```tsx
                className={
                  tier.highlight
                    ? 'relative glass rounded-2xl p-8 ring-1 ring-emerald-500/30'
                    : tier.isPremium
                    ? 'relative bg-charcoal-900 rounded-2xl p-8 ring-1 ring-premium-gold/20 premium-card-glow'
                    : 'relative gborder bg-charcoal-900 rounded-2xl p-8'
                }
```

Note: the card stays `overflow`-visible so the straddling badge is not clipped. The hairline and top gradient are clipped by their own wrapper in Step 4.

- [ ] **Step 4: Add the gold hairline + top gradient wrapper, and restyle the badge**

In `PricingSection.tsx`, the badges block (lines 124-133) currently reads:

```tsx
                {tier.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-[0.22em] text-emerald-300 uppercase bg-charcoal-900 px-3">
                    Most Popular
                  </span>
                )}
                {tier.isPremium && (
                  <span className="absolute -top-3 right-6 text-[10px] font-semibold tracking-[0.22em] text-emerald-300 uppercase bg-charcoal-900 px-3">
                    {copy.pricingBestValueBadge}
                  </span>
                )}
```

Replace that whole block with (the `Most Popular` span is unchanged; the Premium badge is restyled; a clip wrapper is added):

```tsx
                {tier.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-[0.22em] text-emerald-300 uppercase bg-charcoal-900 px-3">
                    Most Popular
                  </span>
                )}
                {tier.isPremium && (
                  <>
                    {/* Clip wrapper: matches the card box, clips the hairline
                        and top gradient to the rounded corners. The card
                        itself stays overflow-visible so the badge can
                        straddle the top edge. */}
                    <div
                      aria-hidden
                      className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none"
                    >
                      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-premium-gold/80 to-transparent" />
                      <div className="absolute top-0 inset-x-0 h-[15%] bg-gradient-to-b from-premium-gold/[0.07] to-transparent" />
                    </div>
                    <span className="absolute -top-3 right-6 text-[9px] font-medium tracking-[0.28em] text-premium-gold/75 uppercase bg-charcoal-900 px-3">
                      {copy.pricingBestValueBadge}
                    </span>
                  </>
                )}
```

- [ ] **Step 5: Make the tier name and feature checks gold for Premium**

In `PricingSection.tsx`, the tier-name `h3` (line 135) currently reads:

```tsx
                  <h3 className="text-[15px] font-semibold text-slate-100 mb-3 uppercase tracking-[0.18em] text-slate-300">{tier.name}</h3>
```

Change it to:

```tsx
                  <h3
                    className={`text-[15px] font-semibold mb-3 uppercase tracking-[0.18em] ${
                      tier.isPremium ? 'text-premium-gold' : 'text-slate-300'
                    }`}
                  >
                    {tier.name}
                  </h3>
```

The feature-list `CheckCircle` (lines 147-152) currently reads:

```tsx
                      <CheckCircle
                        aria-hidden
                        weight="fill"
                        size={16}
                        className="text-emerald-400/90 mt-0.5 shrink-0"
                      />
```

Change it to:

```tsx
                      <CheckCircle
                        aria-hidden
                        weight="fill"
                        size={16}
                        className={`mt-0.5 shrink-0 ${
                          tier.isPremium
                            ? 'text-premium-gold'
                            : 'text-emerald-400/90'
                        }`}
                      />
```

- [ ] **Step 6: Make the Premium CTA gold and add the trust line**

In `PricingSection.tsx`, the CTA `<a>` (lines 157-167) currently reads:

```tsx
                <a
                  href={href}
                  onClick={() => captureClient('pricing_cta_clicked', { plan: tier.plan, billing })}
                  className={
                    tier.highlight
                      ? 'block w-full text-center py-3 px-4 rounded-xl font-semibold bg-white text-charcoal-900 hover:bg-slate-100 transition-all shadow-[0_8px_24px_-8px_rgba(0,0,0,0.2)]'
                      : 'block w-full text-center py-3 px-4 rounded-xl font-semibold gborder bg-charcoal-800 text-slate-200 hover:bg-charcoal-700 transition-colors'
                  }
                >
                  {tier.cta}
                </a>
```

Replace it with (adds the `tier.isPremium` gold branch and the trust line):

```tsx
                <a
                  href={href}
                  onClick={() => captureClient('pricing_cta_clicked', { plan: tier.plan, billing })}
                  className={
                    tier.highlight
                      ? 'block w-full text-center py-3 px-4 rounded-xl font-semibold bg-white text-charcoal-900 hover:bg-slate-100 transition-all shadow-[0_8px_24px_-8px_rgba(0,0,0,0.2)]'
                      : tier.isPremium
                      ? 'block w-full text-center py-3 px-4 rounded-xl font-semibold bg-premium-gold text-premium-canvas-deep hover:bg-premium-gold-bright transition-all'
                      : 'block w-full text-center py-3 px-4 rounded-xl font-semibold gborder bg-charcoal-800 text-slate-200 hover:bg-charcoal-700 transition-colors'
                  }
                >
                  {tier.cta}
                </a>
                {tier.isPremium && (
                  <p className="text-center text-[11px] text-slate-500 mt-3">
                    {copy.pricingPremiumTrust}
                  </p>
                )}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd nichesurage && npx jest src/components/landing/PricingSection.test.tsx`
Expected: all tests PASS, including the three from Step 1.

- [ ] **Step 8: Commit**

```bash
git add nichesurage/src/components/landing/PricingSection.tsx nichesurage/src/components/landing/PricingSection.test.tsx
git commit -m "$(cat <<'EOF'
feat(pricing): gilded premium accent on the Premium tier card

Premium card gets a gold hairline, top gradient, restyled Best Value
badge, gold tier label + checks, gold CTA, hover glow and a trust line.
The muted gborder CTA (weakest in the row) becomes the gold primary.
Basic stays the Most Popular anchor.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Full verification sweep

**Files:** none (verification only)

- [ ] **Step 1: TypeScript**

Run: `cd nichesurage && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full Jest sweep**

Run: `cd nichesurage && npx jest`
Expected: all tests pass (the 466 baseline plus the 5 new UpsellModal tests and 2 net-new PricingSection tests). Zero failures.

- [ ] **Step 3: Lint the touched components**

Run: `cd nichesurage && npx next lint --dir src/components/niche --dir src/components/landing`
Expected: no errors or warnings on `UpsellModal.tsx`, `PricingSection.tsx`, `copy.ts`.

- [ ] **Step 4: Visual check (manual, by the user)**

Run `npm run dev` and confirm:
- `/discover` as a BASIC user → click a Premium-locked niche → modal shows indigo canvas, gold hairline, gold CTA, hover glow.
- `/discover` as a FREE user → modal shows emerald glass (no indigo, no gold).
- Landing `#pricing` → Premium card shows gold hairline, restyled badge, gold CTA, trust line, hover glow; Basic card unchanged.
- Mobile width: both surfaces still readable, nothing clipped.

This step is a checkpoint, not a commit. Report the result before any merge.

---

## Self-Review

**Spec coverage:**
- §1 UpsellModal basic→premium (treatment C): Task 3. ✓
- §2 UpsellModal free→basic (emerald polish): Task 3, `theme` else-branch. ✓
- §3 PricingSection Premium card (gilded A): Task 4. ✓
- §4 Trust signal: Task 2 (copy) + Task 4 Step 6 (render). ✓
- §5 Token revision (premium-gold): Task 1. ✓
- §6 CTA copy kept as-is: no task needed (decision was to keep "Go Premium" / "Upgrade to Premium"). ✓
- Components/files table in spec: all covered. `tailwind.config.ts` correctly excluded (references the CSS var).

**Placeholder scan:** No TBD/TODO/"handle edge cases". Every code step shows full code. ✓

**Type consistency:** `theme` object keys (`panel`, `hairline`, `iconChip`, `icon`, `title`, `body`, `cta`, `secondary`) are identical in both branches. `pricingPremiumTrust` is added to both `en` and `de` so `CopyKeys` stays a consistent union. Test helper names (`copy`, `container`, `screen`) match existing test conventions. ✓

**Deviation note:** DESIGN.md §Premium-tier accent suggests `rounded-md` (6px) for the gold CTA. This plan keeps `rounded-xl` to match the existing pricing and modal CTAs (in-component consistency). Minor, intentional.
