# Premium accent: live apply (scope A)

**Date:** 2026-05-17
**Branch:** `feat/premium-accent`
**Status:** Design approved, pending spec review

## Goal

DESIGN.md `§Premium-tier accent` documents indigo + gold tokens that no component
consumes yet (latent since PR #65). This sprint applies that accent to the two
upsell surfaces that have a live use case today, at production-polish quality:
"premium feel without shouting".

## Scope

**In scope (the 2 live application points):**
1. `UpsellModal` (`src/components/niche/UpsellModal.tsx`)
2. The Premium tier card in `PricingSection` (`src/components/landing/PricingSection.tsx`)

**Out of scope (no live use case today, confirmed in recon):**
- NicheCard Premium badge: Premium niches are hidden entirely for Free/Basic
  (PR #64 fix `ef753cc`), so there is nothing to badge.
- Premium locked-niche overlay: same reason.
- Reactivating Premium-locked niches (a product-policy change): explicitly
  declined for this sprint.

DESIGN.md `§Premium-tier accent` keeps documenting all 4 points as the full
vision; this sprint just implements 1 and 2. No DESIGN.md application points
are removed.

## Design decisions

### 1. UpsellModal, basic to premium variant

This is the modal a BASIC user sees when clicking a Premium-locked niche
(CTA "Upgrade to Premium"). Treatment "C, refined":

- **Background:** indigo gradient from `premium-canvas` (`#1b1938`) to
  `premium-canvas-deep` (`#0e0c1f`), replacing the current charcoal `glass`.
  Uses existing tokens, no new background hex.
- **Gold hairline:** a 1px line across the very top of the modal, gradient
  transparent to gold to transparent. This is the shared "exclusive layer"
  identity element across both surfaces.
- **Hover glow:** an ultra subtle ambient glow (indigo with a trace of gold)
  that fades in and out over ~0.9s on modal hover. Restrained, not pulsing.
- **CTA:** solid gold fill, the primary focus of the modal. Gold is
  desaturated from the current token value (see "Token revision" below).
- **Secondary "Maybe later":** quieter than today, smaller and more muted.
- **Backdrop:** stronger blur behind the modal than the current
  `backdrop-blur-sm`.
- **Shadow:** softer and wider than the current tight emerald-tinted shadow.
- **Lock icon chip:** neutral (white at low alpha background and border), with
  the lock glyph itself in gold.

### 2. UpsellModal, free to basic variant

The same component, shown to a FREE user (CTA "Upgrade to Basic"). It gets the
same layout polish (softer wider shadow, stronger backdrop blur, quieter
secondary button) but keeps the **emerald accent and charcoal `glass`
background**. It does NOT get indigo or gold.

Rationale: indigo `premium-canvas` and gold are reserved for the Premium tier
(DESIGN.md `§Premium-tier accent`: "never for Basic or Free messaging"). The
free to basic upsell targets Basic, whose color in the pricing section is
emerald. Keeping it emerald makes the tier color language correct: both modal
variants share the polished structure, each wears its own tier's color.

Implementation: the component already branches on `isBasic`; accent tokens
(background, hairline, glow, CTA, icon) become tier-derived.

### 3. PricingSection Premium card

Treatment "A, refined" (gilded glass). Today the Premium card has the weakest
CTA in the row (a muted `gborder` button) despite being the most expensive
tier. Refined A fixes that without making the card shout:

- Card stays on the charcoal background, consistent with Free and Basic.
- 1px gold hairline across the top (same element as the modal).
- Gold "Best Value" badge: smaller, thinner weight, wide letter-spacing,
  muted-gold color. Luxurious, not loud.
- Gold tier label and gold feature check marks.
- CTA "Go Premium": gold fill (desaturated gold), becoming the card's primary
  action instead of the current muted button.
- Hover-only gold glow (no persistent glow at rest).
- Deeper, softer shadow under the card than Free and Basic.
- A faint gradient in the top ~15% of the card only.
- The Basic card stays the loud "Most Popular" anchor, unchanged. The standard
  conversion pattern keeps the mid tier as the visual anchor; Premium reads as
  the aspirational upgrade, not a second loud card.

### 4. Trust signal

A single line under the Premium card CTA:
`Cancel anytime · Secure checkout via Stripe`

Both claims are true: Stripe handles cancellation at period end, and checkout
is Stripe-hosted. No social proof ("joined by N creators") is used because the
app is pre-launch and that claim would be false. No money-back guarantee,
because that is a policy the product has not committed to.

This is new user-facing text, so it goes through the `CopyKeys` system as a
new key (`pricingPremiumTrust`), with both English and German values, rather
than being hard-coded.

### 5. Token revision: desaturated gold

While tuning visually, the user dialed gold saturation down ~10 to 15% from the
documented `premium-gold` (`#cbb275`) and approved the softer result. To keep
the design system consistent (CLAUDE.md: all UI consults DESIGN.md, tokens
mirrored), this revises the `premium-gold` token itself rather than introducing
a one-off hex:

- `premium-gold`: `#cbb275` becomes `#c3b088` (a softer, ~12% less saturated
  value, the one approved on the pricing mockup).
- Revised in all three places: `nichesurage/DESIGN.md`, `globals.css`
  (`--premium-gold`), `tailwind.config.ts` (`premium.gold`).
- `premium-gold-bright` and `premium-gold-muted` stay as the lighter and darker
  poles; the implementation plan checks the family still reads coherent.

### 6. CTA copy (recommendation, flag for review)

The original brief asked for "better CTA copy". After the visual iterations,
recommendation is to **keep** the current labels: "Go Premium" (pricing card)
and "Upgrade to Premium" (modal). Both are already short and action-oriented;
the premium feel is delivered visually, which matches the "without shouting"
goal better than louder copy would. This is surfaced here so it can be
overridden at the spec review gate if the user wants different wording.

## Components and files affected

| File | Change |
|---|---|
| `src/components/niche/UpsellModal.tsx` | Tier-aware accent; treatment C for basic, emerald-polished for free |
| `src/components/landing/PricingSection.tsx` | Premium card branch: gilded glass A, gold CTA, trust line |
| `src/components/landing/copy.ts` | New `pricingPremiumTrust` key (en + de) |
| `src/app/globals.css` | Revise `--premium-gold`; add a `premium` hover-glow utility class |
| `tailwind.config.ts` | Revise `premium.gold` value |
| `nichesurage/DESIGN.md` | Revise `premium-gold` token; note the two implemented application points |
| `nichesurage/docs/design/preview.html` | Update gold swatch to the revised value (keep catalog accurate) |

## New CSS

A hover-glow utility class in `globals.css` (following the existing
`.marketing-hero-mesh` precedent) so the ~0.9s ambient glow is not repeated as
verbose Tailwind arbitrary values in two components.

## Testing

- `tsc --noEmit` clean.
- `jest` full sweep green (existing UpsellModal / PricingSection tests must
  still pass; update assertions only where class names they pin actually
  changed).
- `next lint` on the touched components.
- Visual check: both modal variants (free and basic) and the pricing row, at
  desktop and mobile widths.

## Non-goals

- No product-policy change (Premium niches stay hidden for Free/Basic).
- No Stripe / pricing / gating logic change. This is presentation only.
- No change to Free or Basic card visuals beyond what is stated.
