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
  it('free tier: blurred elements present, no channel link, no engagement badge, lock icon shown', () => {
    render(<NicheCard data={shortsBase} userTier="free" rank={1} />)

    expect(screen.queryByRole('link')).toBeNull()
    expect(document.querySelector('[style*="blur"] span')).not.toBeNull()

    const viralityEl = screen.getByText('✨ Excellent')
    expect(viralityEl.closest('[style*="blur"]')).not.toBeNull()

    expect(screen.queryByText(/eng/)).toBeNull()
    expect(screen.getByLabelText(/locked/i)).toBeTruthy()
  })

  it('basic tier shorts: channel link, engagement, avg duration, hook score visible', () => {
    render(<NicheCard data={shortsBasic} userTier="basic" rank={1} />)

    const link = screen.getByRole('link', { name: /Tech Tutorials DE/i })
    expect(link).toHaveAttribute('href', 'https://youtube.com/@techde')

    const viralityEl = screen.getByText('✨ Excellent')
    expect(viralityEl.closest('[style*="blur"]')).toBeNull()

    expect(screen.getByText(/4\.2% eng/i)).toBeTruthy()
    expect(screen.getByText(/62% duration/i)).toBeTruthy()
    expect(screen.getByText(/hook 85/i)).toBeTruthy()
  })

  it('basic tier longform: search volume, competition score, avg views/video visible', () => {
    render(<NicheCard data={longformBasic} userTier="basic" rank={2} />)

    expect(screen.getByText(/5\.1% eng/i)).toBeTruthy()
    const link = screen.getByRole('link', { name: /Finance Explained/i })
    expect(link).toHaveAttribute('href', 'https://youtube.com/@financeexp')
    expect(screen.getByText(/48k searches/i)).toBeTruthy()
    expect(screen.getByText(/34% comp/i)).toBeTruthy()
    expect(screen.getByText(/12\.4k views\/video/i)).toBeTruthy()
  })

  it('skeleton: renders without errors, contains animate-pulse elements', () => {
    render(<NicheCardSkeleton />)
    const pulseEls = document.querySelectorAll('.animate-pulse')
    expect(pulseEls.length).toBeGreaterThan(0)
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
