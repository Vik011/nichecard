# 2026-05-06 — Polish round complete (handoff for next session)

Cinematic redesign of landing + Discover surface is done. App is now production-grade and matches the mockup the user commissioned via external Claude AI design audit. This memo captures end-state and what's queued.

## What landed today (in order)

| PR | Title | Master commit |
|---|---|---|
| #18 | polish: SVG icons + YouTube CTA + refined card hover | `dee2e0b` |
| #19 | polish(landing): SVG glyphs + unify CTA destinations to /discover | `eef598c` |
| #20 | polish(hero): SEO-anchored H1 in Instrument Serif + tighter rhythm | `31e50c9` |
| #21 | polish(landing-nav): tier+email pill + CTA refinement + H1 punctuation | `f6b055a` |
| #22 | polish(hero): live ticker bar + bottom stats bar (mockup-driven) | `762f4e2` |
| #23 | fix(hero): clear nav from ticker + scale up radar across breakpoints | `a89f95c` |
| #24 | polish(hero): split H1 + green pulse pill + sub bold + body slate-200 | `34650d8` |
| #25 | polish(header): avatar circle + tier ring + dropdown + ghost CTA | `219f142` |
| #26 | polish(hero): matched ghost CTA pair + wider column + H1 sized up | `6348911` |

Earlier in the day (before polish):
- #15 content_type detection in discovery
- #16 unified Discover surface
- #17 sort by opportunity_score desc

## Final design state vs original

### Landing hero
- **Pre**: "I built this because YouTube research was eating my weekends" (founder narrative as H1, zero SEO keyword, 52px Geist Sans, 7-element vertical stack with floating LIVE chip + isolated timer in radar corners, plain narrow column)
- **Post**: Two-strip layout with **LiveTickerBar** below nav (`LIVE · 47 spiked · 27 surfaced today`) and **HeroStatsBar** at hero bottom (`230+ CHANNELS / NEXT SCAN ━━ 34:12 · 47 SPIKING NOW / 1h SCAN INTERVAL`). Hero copy stack:
  1. Green pulse pill: `● SCANNING 230+ CHANNELS / HOUR`
  2. H1 split: `Find YouTube niches` (Instrument Serif 72px regular) + `before they explode` (italic 68px)
  3. Italic narrative tagline (slate-300)
  4. Sub paragraph with **bold emphasis** on "the small accounts that started moving" (slate-200, WCAG AA)
  5. Matched ghost CTA pair: `Open app →` + `How it works` (both outlined, same shape)
- Wider column: `max-w-3xl` (768px); H1 has more breathing room with the now-larger radar dish (42/52/64/72rem across breakpoints)

### Header / nav
- **Pre**: Logo · Discover/Pricing/Dashboard · EN/DE · `[BASIC pill] vikmartin.online@gmail.com` · solid indigo "Open app"
- **Post**: Logo · Discover/Pricing/My Channels · EN/DE · **Avatar circle "V"** with caret + tier ring (slate FREE / indigo BASIC / emerald PREMIUM) · ghost outlined "Open app"
- Avatar click → glass dropdown with email + Plan label + Sign out
- Mobile drawer keeps a standalone tier pill (avoid menu-inside-a-menu)

### NicheCard (Discover)
- All 13 emoji icons replaced with Phosphor SVG (📺→Television, ⚡→Lightning, 🔥→Flame, etc.)
- Hover state: 2px lift + indigo glow (was `scale[1.02] + brightness[110]`, harsh)
- ContentTypeBadge pill (SHORTS / LONGFORM) on every card
- Sort by `opportunity_score desc` (was outlier_ratio)

### Niche detail page
- "Visit on YouTube" CTA in real YouTube brand red (#FF0000) with Phosphor YoutubeLogo icon, hover lift + red glow

### Typography
- **Instrument Serif** (Google Fonts via next/font) added as `font-display` Tailwind utility
- Pairs with Geist Sans body — editorial serif over sans gives "authored by a human" character
- Used on hero H1, italic tagline, and big numerals in stats bar (230+, 1h, 47)

## Audit scorecard (pre vs post polish)

| Segment | Pre | Post | Δ |
|---|---|---|---|
| Visual hierarchy | 7.8 | 9.0 | +1.2 |
| Typography | 7.0 | 8.5 | +1.5 |
| CTA clarity | 6.5 | 8.5 | +2.0 |
| Contrast/readability | 6.0 ⚠️ | 8.5 | +2.5 |
| Spacing/layout | 7.2 | 8.5 | +1.3 |
| Brand consistency | 8.2 | 9.5 | +1.3 |
| Atmosphere/cinematic | — | 9.0 | new |

**Average: 7.1 → 8.8** (+1.7)

## What's queued for next session

In priority order:

### 1. Welcome email verification (P0, ~15 min)
Email infrastructure shipped weeks ago but **delivery never confirmed in production**. Steps:
- User signs into a fresh Gmail (or any account that has never logged in)
- Wait 2-5 min for welcome email to arrive
- If no email: pull Vercel logs for `/auth/callback` invocations, look for `[auth/callback] welcome email send failed` lines, fix per memo `2026-05-05-launch-debug.md` Issue 1 (likely Resend API key domain restriction — email lives at `noreply@send.surgeniche.com`).
- Most likely fix: delete current Resend key, generate new one with no domain restriction, replace `RESEND_API_KEY` in Vercel.

### 2. First-login UX (P1, ~2h)
User's deferred vision: new free user signs in with Google → instead of landing on `/discover` with mostly-locked cards, lands on **a single fully-unlocked niche detail page as a "WOW first 30s" demo**. After exit, normal `/discover` with paywall mechanics applies.

Implementation outline:
- Migration: `users.first_login_at timestamptz` column
- `pickFreeDemoNiche()` helper — picks daily-rotating niche by max opportunity_score
- Auth callback: if `first_login_at IS NULL`, set it + redirect to `/discover/niche/<id>?freeDemo=true`
- Niche detail page: when `?freeDemo=true`, render premium-style (no paywall, no blur)
- Cookie or session flag prevents the demo from re-firing on subsequent visits

Why this matters most for activation: free tier landing on `/discover` shows 5+ locked cards which reads as "you're locked out" not "look what we found for you". First-login redirect inverts that to "look what's available — sign up for more like this".

### 3. Free tier reveal Fix B (P2, ~30 min)
Per launch debug memo Issue 3: free user lands on `/discover` with 5 niche cards but the SINGLE unlocked card has random visible/hidden position (1/11 chance it's visible, 10/11 it's hidden behind "Show more"). Original design intent was "always unlocked at position 5".

Fix B: in `discover/page.tsx`, when `userTier === 'free'`, build derived array `[...top4, results[freeRevealIndex]]` and render that instead of `results.slice(0, visibleCount)`. Hide "Show more" for free users (or have it open the upsell modal). Top 4 stay paywalled (FOMO), 5th is the rotating reveal.

Note: VISIBLE_STEP changed 5 → 12 with unified Discover, so logic needs slight update but the principle stands.

### 4. Counter cosmetic fix in insertCandidateChannel (P3, ~15 min)
Channels are inserted but route returns `totalInserted: 0` because Supabase upsert with `ignoreDuplicates: true` returns count=0 even on success. Fix: use `.select()` after upsert and check returned data length.

### 5. Sprint A.6 premium spike scanner (P3, planned but never implemented)
`premiumSpike.ts` + migration `0021` — plan exists in `docs/superpowers/plans/` but never executed. Trend engine partially supersedes it.

### 6. Shorts seed_keywords paralelni discovery (P4)
seed_keywords table currently only has longform seeds. Trending route surfaces shorts via mixed search results but a dedicated shorts seed pool would broaden coverage. Low impact since current discovery does pick up shorts channels.

### 7. Hero micro-polish (P4, optional)
Three tiny refinements I noted but didn't ship:
- CTA `py-3 → py-3.5` to balance visual mass against the now-larger H1
- Radar sweep arm opacity reduced from 0.55 → 0.4 (eliminates the faint blue line crossing the H1 area mid-sweep)
- NEXT SCAN timer label tighter visual grouping with the `34:12` numeral

None of these is a blocker. Could roll into a single "hero micro-polish" PR or skip entirely.

## Architecture / preferences worth remembering

### Design conventions locked
- **Instrument Serif** (font-display) for editorial headings + tagline + big numerals
- **Geist Sans** for body, UI, sub-paragraphs
- Avoid em-dashes in UI copy and chat (user explicitly called out as AI tell)
- All emoji-as-icons replaced with Phosphor SVG; emoji only for atmospheric content (e.g., flag in cards)
- Hover states: scoped `transition-[transform,box-shadow,filter]`, never `transition-all`. Use `-translate-y-[1px]` lift for buttons, `2px` for cards.
- Focus-visible: 2px ring, glow-indigo/60, with offset on carbon-950 base

### File patterns
- Hero stack: LiveTickerBar (above hero, in LandingPage) → HeroSection (hero copy) → HeroStatsBar (bottom of hero, inside HeroSection)
- Hero data props: `radar` (RadarSnapshot from server), `isLoggedIn` (UserContext)
- LandingNav uses `position:fixed` so anything that follows in source needs `mt-16` to clear it (LandingNav h-16 = 64px)

### User preferences
- Communicate in srpski/bosanski; technical terms in English are fine
- Phase-by-phase commits, focused git add (NEVER `-A`)
- Direct opinions when proposed approaches are wrong, not performative agreement
- Iterate fast but ground decisions in data when there's ambiguity
- Plan-mode for significant pivots; ExitPlanMode for approval

## Branch hygiene
- All branches `polish/*`, `fix/*` are merged into master and can be deleted
- Active worktree branch: `polish/hero-cta-pair` (PR #26 commit) — also merged
- Master HEAD: `6348911` (PR #26 squash merge)

## Key file index
| File | Purpose |
|---|---|
| `src/components/landing/HeroSection.tsx` | Hero copy stack, CTA pair, stats bar wiring |
| `src/components/landing/HeroBackdrop.tsx` | Radar visual + rotating ping notification |
| `src/components/landing/LiveTickerBar.tsx` | Top live activity strip |
| `src/components/landing/HeroStatsBar.tsx` | Bottom stats strip with progress bar + countdown |
| `src/components/landing/LandingNav.tsx` | Top nav with avatar dropdown + ghost CTAs |
| `src/components/landing/AvatarMenu.tsx` | Avatar circle + tier ring + glass dropdown |
| `src/components/landing/copy.ts` | All landing copy (EN + DE) |
| `src/app/layout.tsx` | next/font config (Geist + Instrument Serif) |
| `tailwind.config.ts` | Font tokens, brand colors, custom animations |

## End-state acceptance

After today's polish round, the product is:
- ✅ SEO-grade (H1 contains keyword, matches title meta)
- ✅ WCAG AA body contrast (slate-200 on dark)
- ✅ Visually distinctive (Instrument Serif vs generic Inter/Geist-only)
- ✅ Cinematic (radar dominance + telemetry strips + live progress bar)
- ✅ Brand-consistent (one icon language, one type system, one button language)
- ✅ Audit-aligned (visual hierarchy 9.0, contrast 8.5, brand 9.5)
- ✅ Mockup-aligned (every element from external Claude AI mockup landed)

Launch readiness: top three items are welcome email verification, first-login UX, free tier reveal Fix B. After those, Discord launch share.
