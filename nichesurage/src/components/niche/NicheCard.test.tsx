import { render, screen } from '@testing-library/react'
import { NicheCard } from './NicheCard'
import { NicheCardSkeleton } from './NicheCardSkeleton'
import type { ShortsNicheCardData, LongformNicheCardData, NicheCardData } from '@/lib/types'

jest.mock('@/lib/supabase/savedNiches', () => ({
  saveNiche: jest.fn(),
  unsaveNiche: jest.fn(),
}))

const shortsBase: ShortsNicheCardData = {
  id: '1',
  youtubeChannelId: 'UC_shorts_1',
  contentType: 'shorts',
  channelCreatedAt: '2024-01-01',
  videoCount: 47,
  subscriberCount: 5000,
  subscriberRange: '1K–10K',
  spikeMultiplier: 6.2,
  opportunityScore: 78,
  viralityRating: 'excellent',
  language: 'de',
}

const shortsBasic: ShortsNicheCardData = {
  ...shortsBase,
  channelName: 'Tech Tutorials DE',
  nicheLabel: 'YouTube Shorts · Tech',
  channelUrl: 'https://youtube.com/@techde',
  engagementRate: 4.2,
  avgViewDurationPct: 62,
  hookScore: 85,
}

const longformBasic: LongformNicheCardData = {
  id: '2',
  youtubeChannelId: 'UC_longform_2',
  contentType: 'longform',
  channelCreatedAt: '2024-01-01',
  videoCount: 23,
  subscriberCount: 50000,
  subscriberRange: '10K–100K',
  spikeMultiplier: 2.1,
  opportunityScore: 65,
  viralityRating: 'good',
  language: 'en',
  channelName: 'Finance Explained',
  nicheLabel: 'Personal Finance',
  channelUrl: 'https://youtube.com/@financeexp',
  engagementRate: 5.1,
  searchVolume: 48000,
  competitionScore: 34,
  avgViewsPerVideo: 12400,
}

describe('NicheCard', () => {
  it('locked card (revealed=false): blurred fields, no engagement badge, lock icon shown', () => {
    render(<NicheCard data={shortsBase} userTier="free" rank={1} revealed={false} />)

    expect(document.querySelector('[style*="blur"] span')).not.toBeNull()

    // Virality label was emoji-prefixed ("✨ Excellent"); polish pass moved
    // the emoji to a Phosphor Sparkle icon, so the text alone is matched now.
    const viralityEl = screen.getByText('Excellent')
    expect(viralityEl.closest('[style*="blur"]')).not.toBeNull()

    expect(screen.queryByText(/eng/)).toBeNull()
    // The lock icon next to the channel name carries an aria-label of
    // exactly "Locked". The wrapper button carries "Locked niche — upgrade
    // to unlock". Anchor on the exact match so we test the icon, not the
    // wrapper.
    expect(screen.getByLabelText('Locked')).toBeTruthy()
  })

  it('locked card renders as a button (not a link) and triggers onLockedClick', () => {
    const onLockedClick = jest.fn()
    render(
      <NicheCard
        data={shortsBase}
        userTier="free"
        rank={1}
        revealed={false}
        onLockedClick={onLockedClick}
      />,
    )
    expect(screen.queryByRole('link')).toBeNull()
    const btn = screen.getByRole('button', { name: /upgrade to unlock/i })
    btn.click()
    expect(onLockedClick).toHaveBeenCalledTimes(1)
  })

  it('revealed card is a link to the detail page', () => {
    render(<NicheCard data={shortsBasic} userTier="basic" rank={1} revealed />)
    const link = screen.getByRole('link', { name: /detail page for Tech Tutorials DE/i })
    expect(link.getAttribute('href')).toBe('/discover/niche/1')
  })

  it('detail link includes ?from when fromUrl prop is set', () => {
    render(
      <NicheCard
        data={shortsBasic}
        userTier="basic"
        rank={1}
        revealed
        fromUrl="/discover/shorts?subscriberMin=1000"
      />,
    )
    const link = screen.getByRole('link', { name: /detail page/i })
    expect(link.getAttribute('href')).toBe('/discover/niche/1?from=%2Fdiscover%2Fshorts%3FsubscriberMin%3D1000')
  })

  it('defaults to revealed=true for backwards compatibility', () => {
    render(<NicheCard data={shortsBasic} userTier="basic" rank={1} />)
    expect(screen.getByRole('link', { name: /detail page/i })).toBeTruthy()
  })

  it('basic tier shorts: channel name + engagement + avg duration + hook visible', () => {
    render(<NicheCard data={shortsBasic} userTier="basic" rank={1} />)

    expect(screen.getByText('Tech Tutorials DE')).toBeTruthy()

    // Virality label was emoji-prefixed ("✨ Excellent"); polish pass moved
    // the emoji to a Phosphor Sparkle icon, so the text alone is matched now.
    const viralityEl = screen.getByText('Excellent')
    expect(viralityEl.closest('[style*="blur"]')).toBeNull()

    expect(screen.getByText(/4\.2% eng/i)).toBeTruthy()
    expect(screen.getByText(/62% duration/i)).toBeTruthy()
    expect(screen.getByText(/hook 85/i)).toBeTruthy()
  })

  it('basic tier longform: search volume, competition score, avg views/video visible', () => {
    render(<NicheCard data={longformBasic} userTier="basic" rank={2} />)

    expect(screen.getByText('Finance Explained')).toBeTruthy()
    expect(screen.getByText(/5\.1% eng/i)).toBeTruthy()
    expect(screen.getByText(/48k searches/i)).toBeTruthy()
    expect(screen.getByText(/34% comp/i)).toBeTruthy()
    expect(screen.getByText(/12\.4k views\/video/i)).toBeTruthy()
  })

  it('skeleton: renders without errors, contains shimmer elements', () => {
    render(<NicheCardSkeleton />)
    const shimmerEls = document.querySelectorAll('.shimmer')
    expect(shimmerEls.length).toBeGreaterThan(0)
  })

  it('renders BookmarkButton when onBookmarkToggle is provided', () => {
    render(
      <NicheCard
        data={shortsBasic}
        userTier="basic"
        rank={1}
        isSaved={false}
        savedCount={2}
        onBookmarkToggle={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: /save niche/i })).toBeInTheDocument()
  })

  it('does not render BookmarkButton when onBookmarkToggle is not provided', () => {
    render(<NicheCard data={shortsBasic} userTier="basic" rank={1} />)
    expect(screen.queryByRole('button', { name: /save niche/i })).not.toBeInTheDocument()
  })
})

describe('trending badge', () => {
  it('renders fire badge when trending=true', () => {
    const trendingData: NicheCardData = {
      ...shortsBase,
      trending: true,
      spikeMultiplier: 6,
    }
    render(<NicheCard data={trendingData} userTier="free" rank={1} />)
    expect(screen.getByText(/Trending/i)).toBeInTheDocument()
  })

  it('does not render fire badge when trending is undefined', () => {
    render(<NicheCard data={shortsBase} userTier="free" rank={1} />)
    expect(screen.queryByText(/Trending/i)).not.toBeInTheDocument()
  })
})

describe('Spiking Now badge (Part B momentum)', () => {
  const spikingQuery = { name: /spiking now/i } as const

  it('renders the badge when data.spikingNow === true (even if legacy would not fire)', () => {
    // longformBasic has no outlierRatio → legacy isSpikingNow would be false.
    const data: NicheCardData = { ...longformBasic, spikingNow: true }
    render(<NicheCard data={data} userTier="basic" rank={1} revealed />)
    expect(screen.getByRole('status', spikingQuery)).toBeInTheDocument()
  })

  it('does NOT render the badge when data.spikingNow === false overrides a legacy spike', () => {
    // outlierRatio 5 → legacy isSpikingNow(longform) WOULD fire, but the
    // explicit momentum false must win on the momentum feed.
    const data: NicheCardData = { ...longformBasic, outlierRatio: 5, spikingNow: false }
    render(<NicheCard data={data} userTier="basic" rank={1} revealed />)
    expect(screen.queryByRole('status', spikingQuery)).not.toBeInTheDocument()
  })

  it('falls back to legacy isSpikingNow when data.spikingNow is undefined (landing/dashboard)', () => {
    const data: NicheCardData = { ...longformBasic, outlierRatio: 5 } // spikingNow undefined
    render(<NicheCard data={data} userTier="basic" rank={1} revealed />)
    expect(screen.getByRole('status', spikingQuery)).toBeInTheDocument()
  })
})

// TrendBadge integration suite removed in 2026-05-07 trend-engine
// deprecation. Sprint B trend_score / archetype overlay was never
// bootstrapped in production and the badge component was deleted along
// with the rest of the trend UI. Card render now stops at the badge row
// without any trend overlay.
