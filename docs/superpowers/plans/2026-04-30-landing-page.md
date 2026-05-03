# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default Next.js boilerplate at `/` with a 10-section premium dark SaaS landing page that shows real masked niche data from Supabase via ISR and supports EN/DE copy toggle.

**Architecture:** `page.tsx` is an RSC with `revalidate = 1800` that fetches top-6 niches server-side and passes them to a `<LandingPage>` client wrapper. The client wrapper holds `lang` state and composes all section components. Channel names are masked deterministically (same channel always gets the same `Hidden Channel #XYZ` number) using a hash of `youtube_channel_id`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase (`@supabase/supabase-js`), Jest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/supabase/staticClient.ts` | **Create** | Plain Supabase client (no cookies) for ISR use |
| `src/lib/landing/fetchTopNiches.ts` | **Create** | Fetch + mask top-6 niches for landing page |
| `src/lib/landing/fetchTopNiches.test.ts` | **Create** | Unit tests for masking logic |
| `src/lib/types/index.ts` | **Modify** | Add `trending?: boolean` to `BaseNicheCardData` |
| `src/components/niche/NicheCard.tsx` | **Modify** | Render `🔥 Trending` badge when `data.trending` is true |
| `src/components/niche/NicheCard.test.tsx` | **Modify** | Test trending badge rendering |
| `src/components/landing/copy.ts` | **Create** | EN/DE copy constants |
| `src/components/landing/LanguageToggle.tsx` | **Create** | `EN \| DE` toggle button |
| `src/components/landing/LandingPage.tsx` | **Create** | `'use client'` wrapper holding `lang` state, composes all sections |
| `src/components/landing/LandingNav.tsx` | **Create** | Sticky nav with logo, links, CTAs |
| `src/components/landing/HeroSection.tsx` | **Create** | Headline, sub, live badge, CTA buttons |
| `src/components/landing/SocialProofBar.tsx` | **Create** | Trusted-by bar |
| `src/components/landing/AppPreviewSection.tsx` | **Create** | 3-col grid of masked NicheCards + fade overlay + CTA |
| `src/components/landing/PainSolutionSection.tsx` | **Create** | Pain → Solution two-column layout |
| `src/components/landing/FeaturesSection.tsx` | **Create** | 6-card features grid |
| `src/components/landing/PricingSection.tsx` | **Create** | 3-column pricing cards |
| `src/components/landing/TestimonialsSection.tsx` | **Create** | 3 static testimonial cards |
| `src/components/landing/FinalCTASection.tsx` | **Create** | Full-width gradient CTA banner |
| `src/components/landing/LandingFooter.tsx` | **Create** | Footer with links + language toggle |
| `src/app/page.tsx` | **Replace** | RSC entry: fetches niches, renders `<LandingPage>` |
| `src/app/layout.tsx` | **Modify** | Update metadata title/description |

---

## Task 1: Static Supabase Client + fetchTopNiches

**Files:**
- Create: `src/lib/supabase/staticClient.ts`
- Create: `src/lib/landing/fetchTopNiches.ts`
- Create: `src/lib/landing/fetchTopNiches.test.ts`

The cookie-based `server.ts` client breaks in ISR (no request context). We need a plain client.

- [ ] **Step 1.1: Create static Supabase client**

Create `nichesurage/src/lib/supabase/staticClient.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

export function createStaticClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 1.2: Write failing test for fetchTopNiches**

Create `nichesurage/src/lib/landing/fetchTopNiches.test.ts`:

```ts
jest.mock('@/lib/supabase/staticClient', () => ({
  createStaticClient: jest.fn(),
}))

import { createStaticClient } from '@/lib/supabase/staticClient'
import { fetchTopNiches, deterministicChannelNum } from './fetchTopNiches'

const mockCreateStaticClient = createStaticClient as jest.MockedFunction<typeof createStaticClient>

describe('deterministicChannelNum', () => {
  it('returns a number in range 100–999', () => {
    const n = deterministicChannelNum('UCabc123')
    expect(Number(n)).toBeGreaterThanOrEqual(100)
    expect(Number(n)).toBeLessThanOrEqual(999)
  })

  it('is stable — same input always returns same output', () => {
    expect(deterministicChannelNum('UCabc123')).toBe(deterministicChannelNum('UCabc123'))
  })

  it('different channel IDs produce different numbers (very likely)', () => {
    expect(deterministicChannelNum('UCaaa')).not.toBe(deterministicChannelNum('UCbbb'))
  })
})

describe('fetchTopNiches', () => {
  const mockRows = [
    {
      id: 'r1',
      youtube_channel_id: 'UCabc',
      channel_name: 'Real Channel',
      channel_url: 'https://youtube.com/c/real',
      niche_label: 'AI tutorials',
      channel_created_at: '2024-01-01',
      video_count: 50,
      subscriber_count: 5000,
      views_48h: 10000,
      views_avg: 800,
      spike_multiplier: 6,
      engagement_rate: 4.2,
      opportunity_score: 88,
      virality_rating: 'excellent' as const,
      language: 'en' as const,
      content_type: 'shorts' as const,
      hook_score: 8,
      avg_view_duration_pct: 72,
      search_volume: null,
      competition_score: null,
      scanned_at: new Date().toISOString(),
    },
  ]

  beforeEach(() => {
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
    } as unknown
    ;(mockQuery as Record<string, jest.Mock>).limit = jest.fn().mockResolvedValue({
      data: mockRows,
      error: null,
    })
    mockCreateStaticClient.mockReturnValue({
      from: jest.fn().mockReturnValue(mockQuery),
    } as unknown as ReturnType<typeof createStaticClient>)
  })

  it('masks channel_name with deterministic label', async () => {
    const niches = await fetchTopNiches()
    expect(niches[0].channelName).toMatch(/^Hidden Channel #\d{3}$/)
  })

  it('strips channelUrl', async () => {
    const niches = await fetchTopNiches()
    expect(niches[0].channelUrl).toBeUndefined()
  })

  it('sets trending=true when spikeMultiplier >= 5', async () => {
    const niches = await fetchTopNiches()
    expect(niches[0].trending).toBe(true)
  })

  it('sets trending=false when spikeMultiplier < 5', async () => {
    const lowSpikeRows = [{ ...mockRows[0], spike_multiplier: 3 }]
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: lowSpikeRows, error: null }),
    }
    mockCreateStaticClient.mockReturnValue({
      from: jest.fn().mockReturnValue(mockQuery),
    } as unknown as ReturnType<typeof createStaticClient>)
    const niches = await fetchTopNiches()
    expect(niches[0].trending).toBe(false)
  })

  it('returns empty array on Supabase error', async () => {
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    }
    mockCreateStaticClient.mockReturnValue({
      from: jest.fn().mockReturnValue(mockQuery),
    } as unknown as ReturnType<typeof createStaticClient>)
    const niches = await fetchTopNiches()
    expect(niches).toEqual([])
  })
})
```

- [ ] **Step 1.3: Run test — verify it fails (function not found)**

```bash
cd nichesurage && npx jest src/lib/landing/fetchTopNiches.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module './fetchTopNiches'`

- [ ] **Step 1.4: Create fetchTopNiches implementation**

Create `nichesurage/src/lib/landing/fetchTopNiches.ts`:

```ts
import { createStaticClient } from '@/lib/supabase/staticClient'
import { mapRow } from '@/lib/supabase/queries'
import type { NicheCardData } from '@/lib/types'

export function deterministicChannelNum(channelId: string): string {
  let h = 0
  for (let i = 0; i < channelId.length; i++) {
    h = (Math.imul(31, h) + channelId.charCodeAt(i)) | 0
  }
  return String((Math.abs(h) % 900) + 100)
}

export async function fetchTopNiches(): Promise<NicheCardData[]> {
  const supabase = createStaticClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('scan_results_latest')
    .select('*')
    .gte('scanned_at', since)
    .order('opportunity_score', { ascending: false })
    .limit(6)

  if (error || !data) return []

  return data.map((row) => {
    const mapped = mapRow(row)
    return {
      ...mapped,
      channelName: `Hidden Channel #${deterministicChannelNum(row.youtube_channel_id)}`,
      channelUrl: undefined,
      trending: row.spike_multiplier >= 5,
    }
  })
}
```

- [ ] **Step 1.5: Run test — verify all pass**

```bash
cd nichesurage && npx jest src/lib/landing/fetchTopNiches.test.ts --no-coverage
```

Expected: all 7 tests PASS

- [ ] **Step 1.6: Commit**

```bash
cd nichesurage && git add src/lib/supabase/staticClient.ts src/lib/landing/fetchTopNiches.ts src/lib/landing/fetchTopNiches.test.ts
git commit -m "feat: add fetchTopNiches with deterministic channel masking"
```

---

## Task 2: Add `trending` prop to types + NicheCard

**Files:**
- Modify: `src/lib/types/index.ts` (line 32 — `BaseNicheCardData`)
- Modify: `src/components/niche/NicheCard.tsx`
- Modify: `src/components/niche/NicheCard.test.tsx`

- [ ] **Step 2.1: Write failing test for trending badge**

Open `nichesurage/src/components/niche/NicheCard.test.tsx` and add at the bottom of the file (before the last `}`):

```tsx
describe('trending badge', () => {
  it('renders fire badge when trending=true and spike >= 5', () => {
    const trendingData: NicheCardData = {
      ...mockShortsData,
      trending: true,
      spikeMultiplier: 6,
    }
    render(<NicheCard data={trendingData} userTier="free" rank={1} />)
    expect(screen.getByText(/Trending/i)).toBeInTheDocument()
  })

  it('does not render fire badge when trending is undefined', () => {
    render(<NicheCard data={mockShortsData} userTier="free" rank={1} />)
    expect(screen.queryByText(/Trending/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2.2: Run test — verify it fails**

```bash
cd nichesurage && npx jest src/components/niche/NicheCard.test.tsx --no-coverage
```

Expected: FAIL — TypeScript error `trending` does not exist on type

- [ ] **Step 2.3: Add `trending` to BaseNicheCardData**

In `nichesurage/src/lib/types/index.ts`, add `trending?: boolean` to the `BaseNicheCardData` interface after the `engagementRate` line:

```ts
interface BaseNicheCardData {
  id: string
  contentType: ContentType
  channelCreatedAt: string
  videoCount: number
  subscriberRange: string
  spikeMultiplier: number
  opportunityScore: number
  viralityRating: ViralityRating
  language: ContentLanguage
  // basic+ tier fields
  channelName?: string
  nicheLabel?: string
  channelUrl?: string
  views48h?: number
  engagementRate?: number
  // landing page only
  trending?: boolean
}
```

- [ ] **Step 2.4: Update NicheCard to render trending badge**

In `nichesurage/src/components/niche/NicheCard.tsx`, find the `<div className="flex items-center gap-1">` block that contains `<BookmarkButton>` and `<SpikeIndicator>`. Add the trending badge after `<SpikeIndicator>`:

Replace the block (lines 106–118):
```tsx
      <div className="flex items-center gap-1">
        {onBookmarkToggle && (
          <BookmarkButton
            nicheId={data.id}
            isSaved={isSaved ?? false}
            userTier={userTier}
            savedCount={savedCount ?? 0}
            onToggle={onBookmarkToggle}
          />
        )}
        <SpikeIndicator multiplier={data.spikeMultiplier} />
      </div>
```

With:
```tsx
      <div className="flex flex-col items-end gap-1">
        {onBookmarkToggle && (
          <BookmarkButton
            nicheId={data.id}
            isSaved={isSaved ?? false}
            userTier={userTier}
            savedCount={savedCount ?? 0}
            onToggle={onBookmarkToggle}
          />
        )}
        <SpikeIndicator multiplier={data.spikeMultiplier} />
        {data.trending && (
          <span className="flex items-center gap-0.5 text-orange-400 text-xs font-medium">
            🔥 Trending
          </span>
        )}
      </div>
```

- [ ] **Step 2.5: Run tests — verify all pass**

```bash
cd nichesurage && npx jest src/components/niche/NicheCard.test.tsx --no-coverage
```

Expected: all tests PASS

- [ ] **Step 2.6: Commit**

```bash
cd nichesurage && git add src/lib/types/index.ts src/components/niche/NicheCard.tsx src/components/niche/NicheCard.test.tsx
git commit -m "feat: add trending badge to NicheCard"
```

---

## Task 3: Copy constants + LanguageToggle + LandingPage shell

**Files:**
- Create: `src/components/landing/copy.ts`
- Create: `src/components/landing/LanguageToggle.tsx`
- Create: `src/components/landing/LandingPage.tsx`

- [ ] **Step 3.1: Create copy.ts**

Create `nichesurage/src/components/landing/copy.ts`:

```ts
export type Lang = 'en' | 'de'

export const COPY = {
  en: {
    navDiscover: 'Discover',
    navPricing: 'Pricing',
    navDashboard: 'Dashboard',
    navLogin: 'Login',
    navCta: 'Start Free',

    heroHeadline: 'Find YouTube Niches Before They Explode',
    heroSub: 'AI-powered opportunity scanner. Real data, updated hourly.',
    heroBadge: '142 niches spiking right now',
    heroCta: 'Start Free — No Credit Card',
    heroCta2: 'See Pricing →',

    socialTrust: 'Trusted by 2,400+ creators',
    socialNiches: '3,800+ niches tracked',
    socialViews: '12B+ views analysed',

    previewTitle: 'Right now, these niches are spiking',
    previewSub: 'Sign up free to unlock channel names and full metrics',
    previewCta: 'Unlock All Results →',

    painHeadline: 'Stop guessing. Start finding.',
    painTitle: 'The old way',
    painItems: [
      'Hours wasted manually checking YouTube trends',
      'Copying successful channels with no edge',
      'Missing viral windows because you found out too late',
    ],
    solutionTitle: 'With NicheSurge',
    solutionItems: [
      'AI scans 230+ channels every hour, 24/7',
      'Opportunity scores rank niches by your actual chances',
      'Spike alerts catch viral windows before everyone else',
    ],

    featuresTitle: 'Everything you need to dominate a niche',
    features: [
      { icon: '🤖', title: 'AI Opportunity Score', desc: 'Composite score weighing spike, engagement, competition and search volume.' },
      { icon: '⏱', title: 'Hourly Scans', desc: '230+ channels re-analysed every hour so you never miss a spike window.' },
      { icon: '🔥', title: 'Viral Spike Detection', desc: 'Flags channels with 3× or higher 48-hour view jumps the moment they appear.' },
      { icon: '🔖', title: 'Bookmark & Compare', desc: 'Save up to 10 niches on Basic, unlimited on Premium, access anytime.' },
      { icon: '📱', title: 'Shorts + Longform', desc: 'Separate discovery tracks optimised for each format\'s unique metrics.' },
      { icon: '🌍', title: 'EN & DE Markets', desc: 'Filter by language to find underserved opportunities in both markets.' },
    ],

    pricingTitle: 'Simple, transparent pricing',
    pricingFree: 'Free',
    pricingBasic: 'Basic',
    pricingPremium: 'Premium',
    pricingFreePrice: '€0',
    pricingBasicPrice: '€9',
    pricingPremiumPrice: '€29',
    pricingPerMonth: '/ mo',
    pricingCtaFree: 'Get Started',
    pricingCtaBasic: 'Start Basic',
    pricingCtaPremium: 'Go Premium',
    pricingFreeFeatures: ['20 niches per search', 'Opportunity score visible', 'Channel name hidden', '0 bookmarks'],
    pricingBasicFeatures: ['20 niches per search', 'Channel names unlocked', 'Full metrics unlocked', '10 bookmarks'],
    pricingPremiumFeatures: ['20 niches per search', 'Channel names unlocked', 'Full metrics unlocked', 'Unlimited bookmarks'],

    testimonialsTitle: 'Creators who found their niche',
    testimonials: [
      { quote: 'I found a German AI niche with a 7× spike and zero competition. First video hit 80K views.', name: 'Marcus T.', handle: '@marcust_creates' },
      { quote: 'NicheSurge saved me weeks of manual research. The opportunity score is genuinely useful.', name: 'Sarah K.', handle: '@sarahkcontent' },
      { quote: 'As a non-native English creator, the DE filter was exactly what I needed to find my audience.', name: 'Lukas B.', handle: '@lukasbfilms' },
    ],

    ctaHeadline: 'Start finding your next viral niche today',
    ctaButton: 'Create Free Account →',

    footerTagline: 'AI-powered YouTube niche discovery.',
    footerLinks: 'Links',
    footerLegal: 'Legal',
    footerPrivacy: 'Privacy',
    footerTerms: 'Terms',
    footerCopyright: '© 2026 NicheSurge',
  },

  de: {
    navDiscover: 'Entdecken',
    navPricing: 'Preise',
    navDashboard: 'Dashboard',
    navLogin: 'Anmelden',
    navCta: 'Kostenlos starten',

    heroHeadline: 'YouTube-Nischen finden, bevor sie explodieren',
    heroSub: 'KI-gestützter Opportunity-Scanner. Echte Daten, stündlich aktualisiert.',
    heroBadge: '142 Nischen steigen gerade',
    heroCta: 'Kostenlos starten — keine Kreditkarte',
    heroCta2: 'Preise ansehen →',

    socialTrust: 'Vertraut von 2.400+ Creatorn',
    socialNiches: '3.800+ Nischen verfolgt',
    socialViews: '12 Mrd.+ analysierte Views',

    previewTitle: 'Diese Nischen steigen gerade',
    previewSub: 'Kostenlos registrieren, um Kanalnamen und alle Metriken freizuschalten',
    previewCta: 'Alle Ergebnisse freischalten →',

    painHeadline: 'Schluss mit Raten. Anfangen zu finden.',
    painTitle: 'Der alte Weg',
    painItems: [
      'Stunden damit verbracht, YouTube-Trends manuell zu prüfen',
      'Erfolgreiche Kanäle ohne eigenen Vorteil kopieren',
      'Virale Zeitfenster verpassen, weil die Info zu spät kam',
    ],
    solutionTitle: 'Mit NicheSurge',
    solutionItems: [
      'KI scannt stündlich 230+ Kanäle, 24/7',
      'Opportunity-Scores zeigen echte Chancen',
      'Spike-Alerts fangen virale Fenster, bevor alle anderen es wissen',
    ],

    featuresTitle: 'Alles, was du brauchst, um eine Nische zu dominieren',
    features: [
      { icon: '🤖', title: 'KI-Opportunity-Score', desc: 'Kombinierter Score aus Spike, Engagement, Wettbewerb und Suchvolumen.' },
      { icon: '⏱', title: 'Stündliche Scans', desc: '230+ Kanäle werden jede Stunde neu analysiert, damit du kein Spike-Fenster verpasst.' },
      { icon: '🔥', title: 'Viral-Spike-Erkennung', desc: 'Markiert Kanäle mit einem 3-fachen oder höheren 48-Stunden-View-Sprung.' },
      { icon: '🔖', title: 'Bookmarks & Vergleich', desc: 'Bis zu 10 Nischen bei Basic speichern, unbegrenzt bei Premium.' },
      { icon: '📱', title: 'Shorts + Longform', desc: 'Separate Discovery-Tracks, optimiert für die Metriken jedes Formats.' },
      { icon: '🌍', title: 'EN & DE Märkte', desc: 'Nach Sprache filtern, um unerschlossene Chancen in beiden Märkten zu finden.' },
    ],

    pricingTitle: 'Einfache, transparente Preise',
    pricingFree: 'Free',
    pricingBasic: 'Basic',
    pricingPremium: 'Premium',
    pricingFreePrice: '€0',
    pricingBasicPrice: '€9',
    pricingPremiumPrice: '€29',
    pricingPerMonth: '/ Monat',
    pricingCtaFree: 'Jetzt starten',
    pricingCtaBasic: 'Basic starten',
    pricingCtaPremium: 'Premium holen',
    pricingFreeFeatures: ['20 Nischen pro Suche', 'Opportunity-Score sichtbar', 'Kanalname versteckt', '0 Bookmarks'],
    pricingBasicFeatures: ['20 Nischen pro Suche', 'Kanalnamen freigeschaltet', 'Alle Metriken freigeschaltet', '10 Bookmarks'],
    pricingPremiumFeatures: ['20 Nischen pro Suche', 'Kanalnamen freigeschaltet', 'Alle Metriken freigeschaltet', 'Unbegrenzte Bookmarks'],

    testimonialsTitle: 'Creator, die ihre Nische gefunden haben',
    testimonials: [
      { quote: 'Ich fand eine deutsche KI-Nische mit einem 7-fachen Spike und null Konkurrenz. Das erste Video erreichte 80K Views.', name: 'Marcus T.', handle: '@marcust_creates' },
      { quote: 'NicheSurge hat mir wochenlange manuelle Recherche erspart. Der Opportunity-Score ist wirklich nützlich.', name: 'Sarah K.', handle: '@sarahkcontent' },
      { quote: 'Als Nicht-Muttersprachler war der DE-Filter genau das, was ich brauchte, um mein Publikum zu finden.', name: 'Lukas B.', handle: '@lukasbfilms' },
    ],

    ctaHeadline: 'Finde noch heute deine nächste virale Nische',
    ctaButton: 'Kostenloses Konto erstellen →',

    footerTagline: 'KI-gestützte YouTube-Nischen-Entdeckung.',
    footerLinks: 'Links',
    footerLegal: 'Rechtliches',
    footerPrivacy: 'Datenschutz',
    footerTerms: 'AGB',
    footerCopyright: '© 2026 NicheSurge',
  },
} as const

export type CopyKeys = typeof COPY.en
```

- [ ] **Step 3.2: Create LanguageToggle**

Create `nichesurage/src/components/landing/LanguageToggle.tsx`:

```tsx
'use client'
import type { Lang } from './copy'

interface LanguageToggleProps {
  lang: Lang
  onChange: (lang: Lang) => void
}

export function LanguageToggle({ lang, onChange }: LanguageToggleProps) {
  return (
    <div className="flex items-center gap-1 text-sm">
      <button
        onClick={() => onChange('en')}
        className={`px-2 py-0.5 rounded transition-colors ${
          lang === 'en'
            ? 'text-slate-100 font-semibold'
            : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        EN
      </button>
      <span className="text-slate-700">|</span>
      <button
        onClick={() => onChange('de')}
        className={`px-2 py-0.5 rounded transition-colors ${
          lang === 'de'
            ? 'text-slate-100 font-semibold'
            : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        DE
      </button>
    </div>
  )
}
```

- [ ] **Step 3.3: Create LandingPage shell**

Create `nichesurage/src/components/landing/LandingPage.tsx` (sections will be filled in later tasks; import them as you create them):

```tsx
'use client'
import { useState } from 'react'
import type { NicheCardData } from '@/lib/types'
import type { Lang } from './copy'
import { COPY } from './copy'
import { LandingNav } from './LandingNav'
import { HeroSection } from './HeroSection'
import { SocialProofBar } from './SocialProofBar'
import { AppPreviewSection } from './AppPreviewSection'
import { PainSolutionSection } from './PainSolutionSection'
import { FeaturesSection } from './FeaturesSection'
import { PricingSection } from './PricingSection'
import { TestimonialsSection } from './TestimonialsSection'
import { FinalCTASection } from './FinalCTASection'
import { LandingFooter } from './LandingFooter'

interface LandingPageProps {
  niches: NicheCardData[]
}

export function LandingPage({ niches }: LandingPageProps) {
  const [lang, setLang] = useState<Lang>('en')
  const copy = COPY[lang]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <LandingNav copy={copy} lang={lang} onLangChange={setLang} />
      <HeroSection copy={copy} />
      <SocialProofBar copy={copy} />
      <AppPreviewSection niches={niches} copy={copy} />
      <PainSolutionSection copy={copy} />
      <FeaturesSection copy={copy} />
      <PricingSection copy={copy} />
      <TestimonialsSection copy={copy} />
      <FinalCTASection copy={copy} />
      <LandingFooter copy={copy} lang={lang} onLangChange={setLang} />
    </div>
  )
}
```

- [ ] **Step 3.4: Commit**

```bash
cd nichesurage && git add src/components/landing/copy.ts src/components/landing/LanguageToggle.tsx src/components/landing/LandingPage.tsx
git commit -m "feat: add landing copy constants, LanguageToggle, LandingPage shell"
```

---

## Task 4: LandingNav

**Files:**
- Create: `src/components/landing/LandingNav.tsx`

- [ ] **Step 4.1: Create LandingNav**

Create `nichesurage/src/components/landing/LandingNav.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { LanguageToggle } from './LanguageToggle'
import type { CopyKeys, Lang } from './copy'

interface LandingNavProps {
  copy: CopyKeys
  lang: Lang
  onLangChange: (lang: Lang) => void
}

export function LandingNav({ copy, lang, onLangChange }: LandingNavProps) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? 'backdrop-blur-md bg-slate-950/80 border-b border-slate-800'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent"
        >
          NicheSurge
        </Link>

        {/* Desktop links */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
          <Link href="/discover/shorts" className="hover:text-slate-100 transition-colors">
            {copy.navDiscover}
          </Link>
          <a href="#pricing" className="hover:text-slate-100 transition-colors">
            {copy.navPricing}
          </a>
          <LanguageToggle lang={lang} onChange={onLangChange} />
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-slate-400 hover:text-slate-100 transition-colors px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500"
          >
            {copy.navLogin}
          </Link>
          <Link
            href="/login"
            className="text-sm font-semibold px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all text-white"
          >
            {copy.navCta}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-slate-400 hover:text-slate-100"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden bg-slate-900 border-t border-slate-800 px-6 py-4 flex flex-col gap-4">
          <Link href="/discover/shorts" className="text-slate-300 hover:text-white" onClick={() => setMenuOpen(false)}>
            {copy.navDiscover}
          </Link>
          <a href="#pricing" className="text-slate-300 hover:text-white" onClick={() => setMenuOpen(false)}>
            {copy.navPricing}
          </a>
          <LanguageToggle lang={lang} onChange={onLangChange} />
          <Link
            href="/login"
            className="text-center text-sm font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
            onClick={() => setMenuOpen(false)}
          >
            {copy.navCta}
          </Link>
        </div>
      )}
    </header>
  )
}
```

- [ ] **Step 4.2: Commit**

```bash
cd nichesurage && git add src/components/landing/LandingNav.tsx
git commit -m "feat: add LandingNav with scroll effect and mobile drawer"
```

---

## Task 5: HeroSection + SocialProofBar

**Files:**
- Create: `src/components/landing/HeroSection.tsx`
- Create: `src/components/landing/SocialProofBar.tsx`

- [ ] **Step 5.1: Create HeroSection**

Create `nichesurage/src/components/landing/HeroSection.tsx`:

```tsx
import Link from 'next/link'
import type { CopyKeys } from './copy'

interface HeroSectionProps {
  copy: CopyKeys
}

export function HeroSection({ copy }: HeroSectionProps) {
  return (
    <section className="pt-36 pb-24 px-6 text-center">
      <div className="max-w-3xl mx-auto">
        {/* Live badge */}
        <div className="inline-flex items-center gap-2 bg-green-950/60 border border-green-800/50 rounded-full px-4 py-1.5 mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
          </span>
          <span className="text-green-400 text-sm font-medium">{copy.heroBadge}</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
            {copy.heroHeadline}
          </span>
        </h1>

        {/* Sub */}
        <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          {copy.heroSub}
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="w-full sm:w-auto text-base font-semibold px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all text-white shadow-lg shadow-indigo-900/40"
          >
            {copy.heroCta}
          </Link>
          <a
            href="#pricing"
            className="text-slate-400 hover:text-slate-100 transition-colors text-base"
          >
            {copy.heroCta2}
          </a>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 5.2: Create SocialProofBar**

Create `nichesurage/src/components/landing/SocialProofBar.tsx`:

```tsx
import type { CopyKeys } from './copy'

interface SocialProofBarProps {
  copy: CopyKeys
}

export function SocialProofBar({ copy }: SocialProofBarProps) {
  const stats = [copy.socialTrust, copy.socialNiches, copy.socialViews]

  return (
    <section className="py-8 border-y border-slate-800">
      <div className="max-w-4xl mx-auto px-6 flex flex-wrap justify-center gap-8 md:gap-16">
        {stats.map((stat) => (
          <span key={stat} className="text-slate-400 text-sm font-medium">
            {stat}
          </span>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 5.3: Commit**

```bash
cd nichesurage && git add src/components/landing/HeroSection.tsx src/components/landing/SocialProofBar.tsx
git commit -m "feat: add HeroSection and SocialProofBar"
```

---

## Task 6: AppPreviewSection

**Files:**
- Create: `src/components/landing/AppPreviewSection.tsx`

- [ ] **Step 6.1: Create AppPreviewSection**

Create `nichesurage/src/components/landing/AppPreviewSection.tsx`:

```tsx
import type { NicheCardData } from '@/lib/types'
import { NicheCard } from '@/components/niche/NicheCard'
import Link from 'next/link'
import type { CopyKeys } from './copy'

interface AppPreviewSectionProps {
  niches: NicheCardData[]
  copy: CopyKeys
}

export function AppPreviewSection({ niches, copy }: AppPreviewSectionProps) {
  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">{copy.previewTitle}</h2>
          <p className="text-slate-400">{copy.previewSub}</p>
        </div>

        {/* Card grid with fade overlay */}
        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {niches.map((niche, i) => (
              <NicheCard
                key={niche.id}
                data={niche}
                userTier="free"
                rank={i + 1}
              />
            ))}
          </div>

          {/* Bottom fade to mask overflow */}
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
        </div>

        {/* CTA below grid */}
        <div className="text-center mt-8">
          <Link
            href="/login"
            className="inline-block text-base font-semibold px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all text-white shadow-lg shadow-indigo-900/40"
          >
            {copy.previewCta}
          </Link>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 6.2: Commit**

```bash
cd nichesurage && git add src/components/landing/AppPreviewSection.tsx
git commit -m "feat: add AppPreviewSection with masked NicheCard grid"
```

---

## Task 7: PainSolutionSection + FeaturesSection

**Files:**
- Create: `src/components/landing/PainSolutionSection.tsx`
- Create: `src/components/landing/FeaturesSection.tsx`

- [ ] **Step 7.1: Create PainSolutionSection**

Create `nichesurage/src/components/landing/PainSolutionSection.tsx`:

```tsx
import type { CopyKeys } from './copy'

interface PainSolutionSectionProps {
  copy: CopyKeys
}

export function PainSolutionSection({ copy }: PainSolutionSectionProps) {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">{copy.painHeadline}</h2>
        <div className="grid md:grid-cols-2 gap-0">
          {/* Pain */}
          <div className="pr-0 md:pr-12 pb-12 md:pb-0 border-b md:border-b-0 md:border-r border-slate-800">
            <h3 className="text-lg font-semibold text-slate-300 mb-6 flex items-center gap-2">
              <span className="text-red-400">✕</span> {copy.painTitle}
            </h3>
            <ul className="space-y-4">
              {copy.painItems.map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-400">
                  <span className="text-red-500 mt-0.5 shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          {/* Solution */}
          <div className="pl-0 md:pl-12 pt-12 md:pt-0">
            <h3 className="text-lg font-semibold text-slate-300 mb-6 flex items-center gap-2">
              <span className="text-green-400">✓</span> {copy.solutionTitle}
            </h3>
            <ul className="space-y-4">
              {copy.solutionItems.map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-400">
                  <span className="text-green-400 mt-0.5 shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 7.2: Create FeaturesSection**

Create `nichesurage/src/components/landing/FeaturesSection.tsx`:

```tsx
import type { CopyKeys } from './copy'

interface FeaturesSectionProps {
  copy: CopyKeys
}

export function FeaturesSection({ copy }: FeaturesSectionProps) {
  return (
    <section className="py-24 px-6 bg-slate-900/30">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-14">{copy.featuresTitle}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {copy.features.map((f) => (
            <div
              key={f.title}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6"
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="text-slate-100 font-semibold mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 7.3: Commit**

```bash
cd nichesurage && git add src/components/landing/PainSolutionSection.tsx src/components/landing/FeaturesSection.tsx
git commit -m "feat: add PainSolutionSection and FeaturesSection"
```

---

## Task 8: PricingSection

**Files:**
- Create: `src/components/landing/PricingSection.tsx`

- [ ] **Step 8.1: Create PricingSection**

Create `nichesurage/src/components/landing/PricingSection.tsx`:

```tsx
import Link from 'next/link'
import type { CopyKeys } from './copy'

interface PricingSectionProps {
  copy: CopyKeys
}

const TIER_STYLES = {
  free:    { card: 'border-slate-700',    badge: '',                 ring: '' },
  basic:   { card: 'border-indigo-500',   badge: 'bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full', ring: 'ring-2 ring-indigo-500/30' },
  premium: { card: 'border-violet-500',   badge: '',                 ring: '' },
}

export function PricingSection({ copy }: PricingSectionProps) {
  const tiers = [
    {
      key: 'free' as const,
      label: copy.pricingFree,
      price: copy.pricingFreePrice,
      cta: copy.pricingCtaFree,
      features: copy.pricingFreeFeatures,
      highlighted: false,
    },
    {
      key: 'basic' as const,
      label: copy.pricingBasic,
      price: copy.pricingBasicPrice,
      cta: copy.pricingCtaBasic,
      features: copy.pricingBasicFeatures,
      highlighted: true,
    },
    {
      key: 'premium' as const,
      label: copy.pricingPremium,
      price: copy.pricingPremiumPrice,
      cta: copy.pricingCtaPremium,
      features: copy.pricingPremiumFeatures,
      highlighted: false,
    },
  ]

  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-14">{copy.pricingTitle}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {tiers.map((tier) => {
            const styles = TIER_STYLES[tier.key]
            return (
              <div
                key={tier.key}
                className={`bg-slate-900 border ${styles.card} ${styles.ring} rounded-xl p-8 flex flex-col`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg font-semibold text-slate-100">{tier.label}</span>
                  {tier.highlighted && (
                    <span className={styles.badge}>Most Popular</span>
                  )}
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-slate-100">{tier.price}</span>
                  <span className="text-slate-500 text-sm ml-1">{copy.pricingPerMonth}</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-400">
                      <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/login?plan=${tier.key}`}
                  className={`block text-center text-sm font-semibold py-2.5 rounded-lg transition-all ${
                    tier.highlighted
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white'
                      : 'border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-slate-100'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 8.2: Commit**

```bash
cd nichesurage && git add src/components/landing/PricingSection.tsx
git commit -m "feat: add PricingSection with 3-tier cards"
```

---

## Task 9: TestimonialsSection + FinalCTASection + LandingFooter

**Files:**
- Create: `src/components/landing/TestimonialsSection.tsx`
- Create: `src/components/landing/FinalCTASection.tsx`
- Create: `src/components/landing/LandingFooter.tsx`

- [ ] **Step 9.1: Create TestimonialsSection**

Create `nichesurage/src/components/landing/TestimonialsSection.tsx`:

```tsx
import type { CopyKeys } from './copy'

interface TestimonialsSectionProps {
  copy: CopyKeys
}

export function TestimonialsSection({ copy }: TestimonialsSectionProps) {
  return (
    <section className="py-24 px-6 bg-slate-900/30">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-14">{copy.testimonialsTitle}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {copy.testimonials.map((t) => (
            <div
              key={t.handle}
              className="bg-slate-900/50 border border-slate-800 rounded-xl p-6"
            >
              <p className="text-slate-300 text-sm leading-relaxed mb-5">"{t.quote}"</p>
              <div>
                <p className="text-slate-100 text-sm font-semibold">{t.name}</p>
                <p className="text-slate-500 text-xs">{t.handle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 9.2: Create FinalCTASection**

Create `nichesurage/src/components/landing/FinalCTASection.tsx`:

```tsx
import Link from 'next/link'
import type { CopyKeys } from './copy'

interface FinalCTASectionProps {
  copy: CopyKeys
}

export function FinalCTASection({ copy }: FinalCTASectionProps) {
  return (
    <section className="py-28 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <div className="bg-gradient-to-br from-indigo-900/40 to-violet-900/40 border border-indigo-800/30 rounded-2xl px-10 py-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-slate-100">
            {copy.ctaHeadline}
          </h2>
          <Link
            href="/login"
            className="inline-block text-base font-semibold px-10 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all text-white shadow-lg shadow-indigo-900/40"
          >
            {copy.ctaButton}
          </Link>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 9.3: Create LandingFooter**

Create `nichesurage/src/components/landing/LandingFooter.tsx`:

```tsx
import Link from 'next/link'
import { LanguageToggle } from './LanguageToggle'
import type { CopyKeys, Lang } from './copy'

interface LandingFooterProps {
  copy: CopyKeys
  lang: Lang
  onLangChange: (lang: Lang) => void
}

export function LandingFooter({ copy, lang, onLangChange }: LandingFooterProps) {
  return (
    <footer className="border-t border-slate-800 py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Logo + tagline */}
          <div>
            <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              NicheSurge
            </span>
            <p className="text-slate-500 text-sm mt-2">{copy.footerTagline}</p>
          </div>

          {/* Nav links */}
          <div>
            <h4 className="text-slate-300 text-sm font-semibold mb-3">{copy.footerLinks}</h4>
            <ul className="space-y-2">
              <li><Link href="/discover/shorts" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">{copy.navDiscover}</Link></li>
              <li><a href="#pricing" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">{copy.navPricing}</a></li>
              <li><Link href="/login" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">{copy.navLogin}</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-slate-300 text-sm font-semibold mb-3">{copy.footerLegal}</h4>
            <ul className="space-y-2">
              <li><Link href="/privacy" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">{copy.footerPrivacy}</Link></li>
              <li><Link href="/terms" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">{copy.footerTerms}</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-800/50">
          <span className="text-slate-600 text-sm">{copy.footerCopyright}</span>
          <LanguageToggle lang={lang} onChange={onLangChange} />
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 9.4: Commit**

```bash
cd nichesurage && git add src/components/landing/TestimonialsSection.tsx src/components/landing/FinalCTASection.tsx src/components/landing/LandingFooter.tsx
git commit -m "feat: add TestimonialsSection, FinalCTASection, LandingFooter"
```

---

## Task 10: Wire page.tsx + update layout metadata

**Files:**
- Replace: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 10.1: Replace page.tsx**

Replace the entire contents of `nichesurage/src/app/page.tsx` with:

```tsx
import { fetchTopNiches } from '@/lib/landing/fetchTopNiches'
import { LandingPage } from '@/components/landing/LandingPage'

export const revalidate = 1800

export default async function Home() {
  const niches = await fetchTopNiches()
  return <LandingPage niches={niches} />
}
```

- [ ] **Step 10.2: Update layout metadata**

In `nichesurage/src/app/layout.tsx`, replace the `metadata` export:

```tsx
export const metadata: Metadata = {
  title: 'NicheSurge — Find YouTube Niches Before They Explode',
  description: 'AI-powered YouTube niche discovery. Real data, updated hourly. Find viral opportunities before your competition.',
}
```

- [ ] **Step 10.3: Run the full test suite**

```bash
cd nichesurage && npx jest --no-coverage
```

Expected: all existing tests PASS plus the new landing page tests.

- [ ] **Step 10.4: Run TypeScript check**

```bash
cd nichesurage && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10.5: Start dev server and visually verify**

```bash
cd nichesurage && npm run dev
```

Open `http://localhost:3000` and verify:
- All 10 sections render (Nav, Hero, Social proof, Cards, Pain→Solution, Features, Pricing, Testimonials, CTA, Footer)
- 6 niche cards visible with `Hidden Channel #XXX` names (or empty grid if Supabase has no data in last 24h — check network tab)
- Blur + shimmer on locked fields (channel name, virality rating)
- Trending `🔥 Trending` badge on cards with spike ≥ 5
- Language toggle switches all text EN ↔ DE
- Nav becomes frosted glass after scrolling 60px
- Pricing CTAs link to `/login?plan=free|basic|premium`
- No console errors

- [ ] **Step 10.6: Final commit**

```bash
cd nichesurage && git add src/app/page.tsx src/app/layout.tsx
git commit -m "feat: wire landing page RSC with ISR revalidation"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Nav (sticky, scroll effect, mobile drawer) — Task 4
- ✅ Hero (headline, live badge, CTAs) — Task 5
- ✅ Social proof bar — Task 5
- ✅ App preview with 6 masked cards — Task 6
- ✅ Pain → Solution — Task 7
- ✅ Features grid (6 cards) — Task 7
- ✅ Pricing (3 tiers, `/login?plan=X`) — Task 8
- ✅ Testimonials — Task 9
- ✅ Final CTA — Task 9
- ✅ Footer with language toggle — Task 9
- ✅ Deterministic channel masking — Task 1
- ✅ `trending` prop + 🔥 badge — Task 2
- ✅ ISR `revalidate = 1800` — Task 10
- ✅ EN/DE copy toggle — Task 3
- ✅ Static client for ISR (no cookies) — Task 1

**Type consistency:** All components receive `copy: CopyKeys`. `LandingPage` passes `copy={COPY[lang]}` everywhere. `AppPreviewSection` receives `niches: NicheCardData[]`. `deterministicChannelNum` exported from `fetchTopNiches.ts` and tested directly.

**Placeholder scan:** No TBDs. All code blocks are complete.
