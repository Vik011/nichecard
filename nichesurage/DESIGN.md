---
version: alpha
name: NicheSurage
description: A dark, software-craft SaaS dashboard for YouTube niche analysis. Canvas is near-black (#0a0a0c) with a four-level dark surface scale (raised → elevated → overlay → hover) and hairline borders at 5–8% white. The single chromatic accent is emerald (#10b981 / #34d399 bright) — used on positive-signal indicators (trending scores, healthy verdicts, success CTAs) and never decoratively. Display headlines use Instrument Serif at large sizes against Geist Sans body for an "authored by a craftsman" reading feel; technical labels and tabular numerics use Geist Mono. Cards are flat panels with `elev-1/2/3` shadow steps and hairline borders. Three scoped surface variants overlay this base: (1) Dashboard surface — the default everywhere in `/discover`, `/admin`, modals; (2) Marketing & pricing surface — Stripe-inspired weight-300 display headlines with a single gradient-mesh hero band, used on landing + `/pricing` + upgrade modal; (3) Premium-tier accent — a deeper indigo-violet block reserved exclusively for Premium tier upsell prompts and the "Premium" badge.

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
  # === Premium-tier accent surface (filled in Task 5) ===

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
