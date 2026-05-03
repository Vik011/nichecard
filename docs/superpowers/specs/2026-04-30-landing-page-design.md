# NicheSurge — Landing Page Design Spec
**Date:** 2026-04-30  
**Status:** Approved  
**Scope:** `src/app/page.tsx` + new components under `src/components/landing/`

---

## 1. Goals

Replace the default Next.js boilerplate at `/` with a premium dark SaaS landing page that:
- Converts anonymous visitors to paying subscribers
- Shows the product's value immediately via real (masked) niche data
- Maintains sub-second FCP through ISR

---

## 2. Visual Theme

| Token | Value |
|---|---|
| Background | `#060910` (`slate-950`) |
| Primary accent | Indigo `#6366f1` → Violet `#8b5cf6` gradient |
| Spike / viral | Orange `#f97316` |
| Success / live | Green `#4ade80` |
| Text primary | `slate-100` |
| Text muted | `slate-400` |
| Card surface | `slate-900` |
| Card border | `slate-800` |

Font: system stack (no custom font import — matches existing app).

---

## 3. Page Structure (10 sections)

### 3.1 Nav (sticky)
- Logo left: `NicheSurge` wordmark in indigo-to-violet gradient
- Links: `Discover`, `Pricing`, `Dashboard` (shown only when logged in)
- Right: `Login` (outline) + `Start Free` (gradient fill)
- On scroll > 60px: `backdrop-blur-md bg-slate-950/80 border-b border-slate-800`
- Mobile: hamburger collapses to full-width drawer

### 3.2 Hero
- Headline: `"Find YouTube Niches Before They Explode"`
- Sub: `"AI-powered opportunity scanner. Real data, updated hourly."`
- Live badge (pulsing green dot): `"142 niches spiking right now"`  
  _(static copy — no Supabase call here; count updated in copy periodically)_
- CTAs: `"Start Free — No Credit Card"` (gradient, large) + `"See Pricing →"` (text link)
- Layout: centered, `max-w-3xl`, `pt-32 pb-20`

### 3.3 Social Proof Bar
- Single row of logos / text badges: `"Trusted by 2,400+ creators"`, view count stat, niche count stat
- No animation — static, `py-8 border-y border-slate-800`

### 3.4 App Preview — Live Niche Cards (Impression Hook)

**Data source:** ISR fetch via `src/lib/landing/fetchTopNiches.ts`
- Query: top 6 rows from `scan_results_latest` ORDER BY `opportunity_score DESC` WHERE `scanned_at > NOW() - interval '24 hours'`
- Revalidation: `export const revalidate = 1800` (30 min) on the page
- Server-side masking for anonymous visitors:
  - `channel_name` → `"Hidden Channel #" + padStart(index+1, 3, '0')` (e.g. `"Hidden Channel #001"`)
  - `channel_id` / `youtube_channel_id` → omitted entirely from response
  - All other fields (spike_score, opportunity_score, subscriber_count, etc.) pass through unmasked

**Card rendering:**
- Reuse existing `<NicheCard>` with `userTier="free"` — locked fields blur at `blur(3px)` + shimmer (already spec'd in NicheCard)
- Add `trending` prop to NicheCard (or pass as badge): if `spike_score >= 5`, render `🔥` fire icon + `"Trending"` label inline with the MEGA badge
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`, `gap-5`

**Section chrome:**
- Section header: `"Right now, these niches are spiking"`
- Sub: `"Sign up free to unlock channel names and full metrics"`
- Below grid: gradient fade-out overlay at the bottom (masks the 2nd row), then CTA button: `"Unlock All Results →"`

### 3.5 Pain → Solution
- Two-column layout: left = Pain (3 bullet frustrations), right = Solution (3 bullet NicheSurge benefits)
- Visual separator: thin indigo vertical line between columns
- Headline: `"Stop guessing. Start finding."`

### 3.6 Features Grid
- `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`, 6 cards
- Each card: icon (lucide), title, 2-line description
- Features: AI scoring, Hourly scans, Viral spike detection, Bookmark & compare, Shorts + Longform, Tier-based access
- Card style: `bg-slate-900 border border-slate-800 rounded-xl p-6`

### 3.7 Pricing
- 3-column cards: Free / Basic (€9/mo) / Premium (€29/mo)
- Visual: Free = `border-slate-700`, Basic = `border-indigo-500 ring-2 ring-indigo-500/30` (highlighted), Premium = `border-violet-500`
- Feature rows per tier (checkmarks / crosses)
- CTA per card: Free = `"Get Started"`, Basic = `"Start Basic"`, Premium = `"Go Premium"`
- Note: Stripe not integrated yet — CTAs link to `/login` for now, with `?plan=basic` query param preserved for post-Stripe wiring

### 3.8 Testimonials
- 3 cards, avatar + name + handle + quote
- Static copy (no real social data)
- Style: `bg-slate-900/50 border border-slate-800 rounded-xl`

### 3.9 Final CTA
- Full-width section, gradient background (`from-indigo-900/40 to-violet-900/40`)
- Headline: `"Start finding your next viral niche today"`
- Single button: `"Create Free Account →"`

### 3.10 Footer
- 3-column: Logo + tagline | Links (Discover, Pricing, Dashboard, Login) | Legal (Privacy, Terms)
- Bottom row: `© 2026 NicheSurge` + `EN | DE` language toggle (static for now — no i18n library)

---

## 4. Language Toggle (EN/DE)

- Client component `<LanguageToggle>` with `useState('en')`
- Renders in Nav (desktop) and Footer
- All landing copy stored in a `COPY` constant object keyed by `lang`:
  ```ts
  const COPY = {
    en: { heroHeadline: "Find YouTube Niches...", ... },
    de: { heroHeadline: "YouTube-Nischen finden...", ... },
  }
  ```
- State lives in `<LandingPage>` client wrapper; ISR-fetched card data is server-rendered and language-agnostic

---

## 5. Data Flow

```
page.tsx (RSC, revalidate=1800)
  └── fetchTopNiches()                     ← src/lib/landing/fetchTopNiches.ts
      └── supabase (service role, server)
          └── scan_results_latest VIEW
              └── top 6 by opportunity_score, last 24h
              └── mask channel_name + strip channel_id

  └── <LandingPage data={niches} />        ← 'use client' wrapper for language state
      ├── <LandingNav />
      ├── <HeroSection lang />
      ├── <SocialProofBar lang />
      ├── <AppPreviewSection niches lang /> ← renders NicheCard ×6 with userTier="free"
      ├── <PainSolutionSection lang />
      ├── <FeaturesSection lang />
      ├── <PricingSection lang />
      ├── <TestimonialsSection lang />
      ├── <FinalCTASection lang />
      └── <LandingFooter lang />
```

---

## 6. NicheCard `trending` Prop

Extend `NicheCardData` with optional `trending?: boolean`. When `true`:
- Render `🔥` icon + `"Trending"` text badge inline next to the MEGA spike badge
- Only pass `trending={true}` from the landing page fetch (not from discover page)

---

## 7. File Structure

```
src/
  app/
    page.tsx                              ← RSC, revalidate=1800, fetches niches, renders <LandingPage>
  components/
    landing/
      LandingPage.tsx                     ← 'use client', holds lang state, composes all sections
      LandingNav.tsx
      HeroSection.tsx
      SocialProofBar.tsx
      AppPreviewSection.tsx
      PainSolutionSection.tsx
      FeaturesSection.tsx
      PricingSection.tsx
      TestimonialsSection.tsx
      FinalCTASection.tsx
      LandingFooter.tsx
      LanguageToggle.tsx
      copy.ts                             ← EN/DE copy constants
  lib/
    landing/
      fetchTopNiches.ts                   ← masked Supabase fetch
```

---

## 8. Performance Constraints

- `page.tsx` is an RSC with `revalidate = 1800` — no `'use client'` at page level
- Niche cards rendered on server (no hydration cost for card data)
- `<LandingPage>` is a thin client shell only for `lang` state — minimal JS bundle
- No new font imports, no heavy animation libraries

---

## 9. Scope Exclusions

- **Stripe integration** — deferred; pricing CTAs link to `/login?plan=X` for now
- **i18n library** — static copy object only, no `next-intl` or similar
- **Live realtime badge** count in hero — static copy, not a Supabase subscription
- **Discover grid refactor** (3-col grid, stats bar, LIVE badge) — separate task

---

## 10. Acceptance Criteria

- `/` renders all 10 sections with no JS errors
- 6 niche cards visible with channel names masked (`Hidden Channel #001`–`#006`)
- Blur + shimmer visible on locked fields (channel name, virality rating, engagement rate)
- Trending fire badge appears on cards with spike_score ≥ 5
- Language toggle switches all visible copy between EN and DE
- `npm run build` passes with no TypeScript errors
- Pricing CTAs navigate to `/login?plan=free|basic|premium`
