---
version: alpha
name: NicheSurage
description: A dark, software-craft SaaS dashboard for YouTube niche analysis. Canvas is near-black (#0a0a0c) with a four-level dark surface scale (raised → elevated → overlay → hover) and hairline borders at 5–8% white. The single chromatic accent is emerald (#10b981 / #34d399 bright) — used on positive-signal indicators (trending scores, healthy verdicts, success CTAs) and never decoratively. Display headlines use Instrument Serif at large sizes against Geist Sans body for an "authored by a craftsman" reading feel; technical labels and tabular numerics use Geist Mono. Cards are flat panels with `elev-1/2/3` shadow steps and hairline borders. Three scoped surface variants overlay this base: (1) Dashboard surface — the default everywhere in `/discover`, `/admin`, modals; (2) Marketing & pricing surface — Stripe-inspired editorial display headlines with a single gradient-mesh hero band, used on landing + `/pricing` + upgrade modal; (3) Premium-tier accent — a deeper indigo-violet block reserved exclusively for Premium tier upsell prompts and the "Premium" badge.

colors:
  # === Dashboard surface (default) ===
  canvas: "#0a0a0c"
  surface-raised: "#0f1016"
  surface-elevated: "#14151d"
  surface-overlay: "#1b1d27"
  surface-hover: "#262936"
  surface-glass: "rgba(14, 15, 22, 0.62)"
  surface-glass-strong: "rgba(10, 11, 16, 0.72)"
  hairline-soft: "rgba(255, 255, 255, 0.05)"
  hairline-edge: "rgba(255, 255, 255, 0.08)"
  ink: "#ededed"
  ink-muted: "#a8acbb"
  ink-subtle: "#6b7081"
  accent-emerald: "#10b981"
  accent-emerald-bright: "#34d399"
  on-accent: "#04140d"
  # === Marketing & pricing surface (filled in Task 4) ===
  marketing-canvas: "#0a0a0c"
  marketing-canvas-cool: "#080912"
  marketing-hero-gradient-1: "#533afd"
  marketing-hero-gradient-2: "#1a8cd8"
  marketing-hero-gradient-3: "#10b981"
  marketing-card: "#0f1016"
  marketing-card-hover: "#14151d"
  marketing-ink: "#ededed"
  # === Premium-tier accent surface (filled in Task 5) ===
  premium-canvas: "#1b1938"
  premium-canvas-deep: "#0e0c1f"
  premium-violet-soft: "#c9b4fa"
  premium-violet-glow: "#5e6ad2"
  premium-hairline: "rgba(255,255,255,0.10)"
  premium-gold: "#cbb275"
  premium-gold-bright: "#e2c989"
  premium-gold-mute: "#8a7847"
  premium-ink: "#ffffff"
  premium-ink-mute: "#bcbac9"

typography:
  # Display — editorial serif, used on hero + section H1 ONLY
  display-xxl:
    fontFamily: "var(--font-instrument-serif), Georgia, serif"
    fontSize: 72px
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: -1.8px
  display-xl:
    fontFamily: "var(--font-instrument-serif), Georgia, serif"
    fontSize: 56px
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: -1.2px
  display-lg:
    fontFamily: "var(--font-instrument-serif), Georgia, serif"
    fontSize: 40px
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: -0.8px
  # Headline — Geist Sans, dense UI / dashboard / modal H1
  headline:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.20
    letterSpacing: -0.4px
  card-title:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.3px
  subhead:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.40
    letterSpacing: -0.1px
  body:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  body-sm:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0
  caption:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.40
    letterSpacing: 0.08px
  # Monospace — tabular numerics, code, technical labels
  mono-num:
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.30
    letterSpacing: 0
    fontFeature: "tnum"
  mono-label:
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.30
    letterSpacing: 0.22em
    textTransform: uppercase
---

## 1. Visual Theme & Atmosphere

NicheSurage reads as a **software-craft dashboard**: near-black canvas, dense type, single emerald accent, hairline panel borders. Every page surface descends from one of four levels, canvas to raised to elevated to overlay, and the level is what conveys hierarchy, not color. The product feel is "research workstation", not "marketing splash."

Three surfaces compose the system. Use exactly one per page:

1. **Dashboard surface (default)** — `/discover`, `/admin`, `/dashboard`, all modals. Dark, dense, emerald-positive.
2. **Marketing & pricing surface** — `/`, `/pricing`, the upgrade modal. Stripe-inspired: weight-300 display serif at hero scale, single gradient mesh band, tabular numerics for prices, white-leaning cards on a slightly cooler dark.
3. **Premium-tier accent** — Premium badge on NicheCard, Premium-locked overlays, "Upgrade to Premium" CTAs. Deep indigo-violet block (`#1b1938`-family) used as a 200–400px-tall section band, never as full-page canvas. Reserved exclusively for the highest-value upsell moments; never for Basic or Free messaging.

## 2. Color Palette & Roles

(See frontmatter `colors:` for hex values.)

| Role | Token | Live CSS var | Used on |
|------|-------|--------------|---------|
| Canvas | `canvas` | `--color-bg-base` | `<body>` background, full-page sections |
| Raised | `surface-raised` | `--color-bg-raised` | Cards, side panels, nav bar |
| Elevated | `surface-elevated` | `--color-bg-elevated` | Modals, dropdowns, second-level surfaces inside cards |
| Overlay | `surface-overlay` | `--color-bg-overlay` | Popovers, tooltips, third-level (modal-inside-card) |
| Hover | `surface-hover` | `--color-bg-hover` | Row hover, button hover |
| Hairline soft | `hairline-soft` | `--color-border-soft` | Inner card dividers, subtle grid lines |
| Hairline edge | `hairline-edge` | `--color-border-edge` | Card outer borders, input borders |
| Ink | `ink` | `--foreground` | Primary text |
| Ink muted | `ink-muted` | _proposed, wired in Task 7_ | Secondary text, meta |
| Ink subtle | `ink-subtle` | _proposed, wired in Task 7_ | Tertiary text, disabled state |
| Accent emerald | `accent-emerald` | `--color-accent-emerald` | Positive signals (high trend score, healthy verdict, primary CTA fill) |
| Accent emerald bright | `accent-emerald-bright` | `--color-accent-emerald-bright` | Hover state of emerald, focus ring, sparkline strokes |
| On-accent | `on-accent` | _proposed, wired in Task 7_ | Foreground text on emerald fill (e.g., primary button text) |

**Rule:** emerald is NEVER decorative. It marks positive signal or primary action. Never use it as a background for inert sections.

**Naming bridge for agents:** DESIGN.md uses semantic role names (`surface-raised`, `hairline-edge`, `ink`). Live `globals.css` uses category names (`--color-bg-raised`, `--color-border-edge`, `--foreground`). When emitting CSS, reach for the existing live variable in the right column. Do not invent new `--color-canvas` or `--color-ink` variables; the rename is a documentation-only abstraction.

## 3. Typography Rules

(See frontmatter `typography:` for the full scale.)

- **Display serif (`display-xxl/xl/lg`):** Instrument Serif at large sizes with negative letter-spacing. ONLY on hero H1 and section landmark H1 on marketing surface. Never inside dashboard cards.
- **Headline / card-title / subhead:** Geist Sans, weights 500–600, negative letter-spacing scaling with size.
- **Body / body-sm:** Geist Sans 400, neutral tracking, 1.5–1.55 line-height for reading density.
- **Caption:** Geist Sans 500, slightly above body weight to keep 12px legible on dark backgrounds.
- **Mono-num:** Geist Mono with `font-variant-numeric: tabular-nums`. ALL numeric data in dashboard cards (view counts, score, %, currency) uses this; tabular alignment is what separates "dashboard" from "blog."
- **Mono-label:** Geist Mono uppercase with `0.22em` tracking. Eyebrow labels above sections, status pills: "BREAKOUT", "PREMIUM", "TRENDING".

**LetterSpacing unit convention:** the type ladder documents letter-spacing in `px` for design-time precision (e.g., `display-xxl` is `-1.8px` at 72px). When emitting Tailwind classes use the `em` equivalent so values scale with the font size: `-1.8px / 72px ≈ -0.025em`. Existing landing components already use this convention (`tracking-[-0.02em]`, `tracking-[-0.025em]`). Convert before applying; never hard-code `letter-spacing: -1.8px` in CSS where the element font-size might change responsively.

## 4. Component Stylings

> **Token API status:** The class names below (`bg-surface-raised`, `text-on-accent`, `border-hairline-edge`, etc.) are the **target** Tailwind token API. They become live when Task 6 of this plan wires the tokens into `tailwind.config.ts` + `globals.css`. Until that ships, live components reach the same colors via the existing groups (`glass`, `charcoal-*`, `slate-*`, `text-emerald-*`). After Task 6, the new tokens are the canonical way and existing components migrate opportunistically (no big-bang refactor).

### Buttons
- **Primary (emerald):** `bg-accent-emerald text-on-accent`, hover to `bg-accent-emerald-bright`, focus ring `accent-emerald-bright` at 2px offset. Radius `rounded-md` (6px). Height 36/40/44 (sm/md/lg). Weight 500.
- **Secondary (ghost-on-dark):** `bg-transparent border border-hairline-edge text-ink`, hover to `bg-surface-hover`.
- **Tertiary (text-only):** `bg-transparent text-ink-muted`, hover to `text-ink`. No border. Used inside dense card chrome.
- **Premium upgrade CTA:** see §Premium-tier accent below.

### Cards (NicheCard, generic panel)
- `bg-surface-raised border border-hairline-edge rounded-xl` (12px). Inner padding `p-5` to `p-6`. Inner dividers `border-t border-hairline-soft`.
- Shadow: `shadow-elev-1` default, `shadow-elev-2` on hover (with `translate-y-[-1px]` lift), `shadow-elev-3` on focus-visible.
- Hover transition: 150ms ease-out. Never overshoot; this is a workstation, not a toy.

### Inputs
- `bg-surface-elevated border border-hairline-edge text-ink placeholder:text-ink-subtle rounded-md px-3 py-2 text-sm`.
- Focus: `outline-none ring-2 ring-accent-emerald-bright/40 border-accent-emerald`.

### Pills / Badges
- Default: `bg-surface-elevated text-ink-muted rounded-full px-2.5 py-0.5 text-xs font-medium`.
- Mono-label variant: `font-mono uppercase tracking-label text-[11px]`.
- Status colors: emerald (positive), amber (`#f59e0b`, warning), red (`#ef4444`, alert). Apply only as foreground + 10% background tint, never as full saturated fill.

### Nav bar
- `bg-canvas/80 backdrop-blur-md border-b border-hairline-edge`. Height 56px. Logo + segmented control + user menu. Body type Geist Sans 14px weight-500.

### Modal
- Outer: `bg-canvas/80` backdrop with `backdrop-blur-sm`. Inner panel: `bg-surface-elevated border border-hairline-edge rounded-2xl shadow-elev-3`. Max-width `max-w-6xl` desktop, full-width bottom-sheet on mobile (per `feat/niche-detail-modal-redesign`).

## 5. Layout Principles

- **Spacing scale:** Tailwind default (4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96). Section vertical rhythm uses `py-12 lg:py-20` on marketing surface, `py-6 lg:py-8` on dashboard.
- **Grid:** Dashboard pages center on `max-w-6xl` with `px-4` (`/discover`, NicheDetail modal). Admin pages use the wider `max-w-7xl` with `px-6` (more dense tabular data). Marketing uses 12-column at `max-w-6xl` with `px-6 lg:px-12` for a tighter editorial feel.
- **Whitespace:** Dense (Linear-density) on dashboard cards; content edges within `p-5`. Generous on marketing; section padding `py-20` minimum, hero `py-32`.

## 6. Depth & Elevation

| Level | Token | Used on |
|-------|-------|---------|
| 0 (flat) | (no shadow) | Canvas-level page sections |
| 1 | `shadow-elev-1` | Default cards, nav bar |
| 2 | `shadow-elev-2` | Hover state of cards, sticky headers |
| 3 | `shadow-elev-3` | Modals, popovers, focus state |

Surface levels (raised → elevated → overlay) carry depth visually; shadows are additive emphasis, not the primary cue.

## 7. Do's and Don'ts

**Do:**
- Use emerald for positive signal and primary action only.
- Use mono for ALL dashboard numerics (tabular alignment).
- Use Instrument Serif display sparingly; hero H1 and section landmark H1 only.
- Keep dashboard cards on `surface-raised`; nest modals on `surface-elevated`; popovers on `surface-overlay`.
- Use hairline borders (`hairline-edge` 8% white) for card outlines; never solid 1px borders at 20–50% white.

**Don't:**
- Don't use emerald as a background tint for inert sections.
- Don't mix display serif and sans serif in the same H1; pick one per surface.
- Don't introduce additional accent colors. Status colors (amber, red) are functional, not decorative.
- Don't flat-fill saturated colors. Status pills use foreground color + 10% background tint.
- Don't use radius > 12px on **dashboard cards** (NicheCard, generic panels), or > 8px on inputs. Modals, sheet panels, and bottom-sheets use `rounded-2xl` (16px) — that is the explicit carve-out for floating surfaces. Round-everything (every surface above 16px) is a toy aesthetic.
- Don't put marketing-surface gradients on dashboard pages.
- Don't use premium-tier indigo for Free or Basic messaging; it dilutes the Premium signal.

## 8. Responsive Behavior

- Breakpoints: Tailwind defaults (`sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`).
- Touch targets at least 44×44 on `<= md`. Pills with action become full-height buttons on mobile.
- NicheCard grid: 1 col `< md`, 2 col `md`, 3 col `lg` (current). A 4-column `xl` tier is reserved as a future expansion when card density supports it — do not add until card width audit confirms readability at 4-up.
- Modal: centered dialog `>= md`, bottom-sheet drag-to-dismiss `< md` (per `BottomSheet.tsx`).
- Type collapses: `display-xxl` 72px to 48px `< md`, `display-xl` 56px to 40px `< md`, `headline` 28px to 24px `< md`.

## 9. Agent Prompt Guide

Quick reference for AI agents implementing UI:

**For a dashboard card:**
> "Render a card on `surface-raised` with `hairline-edge` 1px border, radius 12, padding 20–24. Title in `card-title` Geist Sans 600 with -0.3px tracking. Body in `body` Geist Sans 14/22. Numerics in `mono-num`. Emerald only on positive-signal pills or the primary CTA."

**For a marketing hero (see §Marketing surface block below):**
> "Use `display-xxl` Instrument Serif 72px weight-400 negative tracking -1.8px (apply as `tracking-[-0.025em]` in Tailwind). Place over the canvas with the single gradient-mesh band background (see §Marketing surface). Hero CTA is emerald primary button."

**For a Premium upgrade prompt (see §Premium-tier accent block below):**
> "Wrap the prompt in a Premium accent block (see §Premium-tier accent below for full token names). Deep indigo `premium-canvas` panel with a subtle gold hairline border. Premium badge in mono-label uppercase, gold-on-deep-indigo. CTA is gold-fill button (`premium-gold` background, `premium-canvas-deep` text) reading 'Upgrade to Premium'."

---

## §Marketing surface (landing + pricing + upgrade modal)

**When to apply:** `/`, `/pricing`, the upgrade modal (`<UpgradeModal>`), any future blog/changelog pages. Everything else uses the dashboard surface.

### Canvas + hero
- Body canvas: `marketing-canvas` (same `#0a0a0c` as dashboard, no jump).
- Hero only: full-width band, Tailwind `py-24 lg:py-40` (96px / 160px), with a **single gradient mesh** absolutely positioned behind the content, opacity 0.35, blur 80px.

Gradient mesh CSS (place in `globals.css` under a `.marketing-hero-mesh` utility class):

```css
.marketing-hero-mesh {
  background-image:
    radial-gradient(ellipse 800px 400px at 20% 30%, var(--marketing-hero-gradient-1, #533afd) 0%, transparent 60%),
    radial-gradient(ellipse 600px 400px at 80% 20%, var(--marketing-hero-gradient-2, #1a8cd8) 0%, transparent 60%),
    radial-gradient(ellipse 700px 300px at 50% 80%, var(--marketing-hero-gradient-3, #10b981) 0%, transparent 60%);
  filter: blur(80px);
  opacity: 0.35;
  pointer-events: none;
}
```

ONE mesh per page, in the hero. Not on every section.

### Typography on marketing surface
- Hero H1: `display-xxl` (Instrument Serif 72px, line-height 1.05, tracking -1.8px applied as `tracking-[-0.025em]`). Mobile collapse: 48px.
- Section H1: `display-xl` (Instrument Serif 56px). Mobile: 40px.
- Eyebrow above H1: `mono-label` uppercase emerald.
- Subheading under H1: `subhead` (Geist Sans 16px weight-500), `ink-muted` color.

### Pricing cards
- Background: `marketing-card`. Border: `hairline-edge`. Radius: `rounded-2xl` (16px, per §7 floating-surface carve-out).
- Tier name: `card-title` Geist Sans 600.
- Price: `display-lg` Instrument Serif 40px, **with `mono-num` for the digits** (composite — serif euro/dollar symbol + mono digits gives the editorial-finance feel Stripe uses). `font-variant-numeric: tabular-nums`.
- Per-month label: `caption` Geist Sans 500 `ink-subtle`.
- Feature list: `body` Geist Sans 14px, emerald check icons, `ink-muted` line text.
- "Most popular" pill (on Basic, the default conversion target): `accent-emerald` background with `on-accent` text, position absolute top-right corner.
- Premium tier card: see §Premium-tier accent block.

### Stripe checkout transition
The Stripe-hosted checkout page is light-themed by default. To minimize the jump:
- Just before redirecting to Stripe, show a 200ms `bg-canvas` to `bg-surface-glass-strong` fade with a small "Redirecting to secure checkout..." caption.
- Configure Stripe Checkout `branding.primary_color` in Dashboard → Settings → Branding to `#10b981` so the Stripe page mirrors the emerald CTA.

### Don'ts on marketing surface
- Don't put more than one gradient mesh on a page.
- Don't make every section feel like a hero. Hero is hero; the rest is editorial density (Linear cadence) with whitespace.
- Don't drop the marketing surface inside the dashboard. The route boundary is the rule.

---

## §Premium-tier accent (Premium upsell only)

**When to apply:** EXCLUSIVELY on:
1. The Premium tier card in `/pricing`.
2. The "Upgrade to Premium" CTA inside `<UpgradeModal>`.
3. The Premium badge that appears on NicheCard when a niche is Premium-locked.
4. The locked-content overlay on premium niches when the viewer is Free/Basic.

**Do not apply** to Free or Basic tier visuals, to general upgrade prompts that don't specifically target Premium, or as decoration on the dashboard.

### Block structure
A Premium accent surface is a **bounded section**, never a full-page canvas. It appears as a band or panel inside an otherwise dashboard-surface or marketing-surface page.

**Band variant** (used in `/pricing` and `<UpgradeModal>`):
- Background: `premium-canvas` (`#1b1938`).
- Top + bottom hairline: `premium-hairline`.
- Inner radial glow centered: `premium-violet-glow` 30% alpha, blur 120px, positioned center-top.
- Min-height: 320px desktop, 240px mobile.

**Badge variant** (used on NicheCard for Premium niches):
- Pill background: `premium-canvas-deep` (`#0e0c1f`).
- Text: `mono-label` uppercase, color `premium-gold-bright`.
- Optional: 1px inner glow `premium-violet-glow` 20% alpha.

### Typography on Premium accent
- Heading: `headline` Geist Sans 600, color `premium-ink` (`#ffffff`, full white for higher contrast against deep indigo, not the dashboard `ink: #ededed`).
- Body: `body` Geist Sans 14/22, color `premium-ink-mute`.
- Mono labels ("PREMIUM", "UPGRADE", "BREAKOUT"): `mono-label`, color `premium-gold`.
- Price: same composite as marketing pricing card, but digits in `premium-gold-bright`.

### Premium upgrade CTA button
This is the ONLY button in the system that uses gold fill. Reserved.

- Background: `premium-gold` (`#cbb275`).
- Text: `premium-canvas-deep` (`#0e0c1f`), Geist Sans 600.
- Hover: `premium-gold-bright`.
- Focus ring: `premium-gold-bright` 2px offset.
- Radius `rounded-md` (6px).
- Letter spacing: `tracking-tight` -0.2px.

### Premium badge spec
On `NicheCard` for Premium-tier niches, a 1-line pill renders top-right of the card:

```
[★ PREMIUM]
```

- Star icon: 12px, `premium-gold`.
- Text: `mono-label` 11px, `premium-gold-bright`, tracking `label` (0.14em).
- Pill: `premium-canvas-deep` background, 1px `premium-gold-mute` border (subtle), `rounded-full` `px-2 py-0.5`.

### Locked-niche overlay
When a Free/Basic viewer hovers a Premium niche, the card content blurs (`backdrop-blur-sm`) and an overlay renders:

- Overlay: `premium-canvas/85` with `backdrop-blur-md`.
- Lock icon: 24px, `premium-gold`, centered.
- Caption below icon: "Premium niche, upgrade to view" in `caption` Geist Sans 500 `premium-ink-mute`.
- CTA below caption: gold "Upgrade to Premium" button (per spec above).

### Don'ts on Premium accent
- Don't use gold anywhere outside Premium accent contexts. Gold = Premium signal, period.
- Don't use the Premium canvas as a full-page background. It is always bounded.
- Don't combine gradient mesh (marketing surface) with Premium accent on the same page section. Pick one.
- Don't downscale Premium accent to use as a "fancy" treatment for non-Premium content; it dilutes the signal.
