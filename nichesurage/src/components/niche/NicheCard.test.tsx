import { render, screen } from '@testing-library/react'
import { NicheCard } from './NicheCard'
import { NicheCardSkeleton } from './NicheCardSkeleton'
import type { NicheCardData } from '@/lib/types'

const baseData: NicheCardData = {
  id: '1',
  channelCreatedAt: '2024-01-01',
  videoCount: 47,
  subscriberRange: '1K–10K',
  spikeMultiplier: 6.2,
  opportunityScore: 78,
  viralityRating: 'excellent',
  language: 'de',
}

const basicData: NicheCardData = {
  ...baseData,
  channelName: 'Tech Tutorials DE',
  nicheLabel: 'YouTube Shorts · Tech',
  channelUrl: 'https://youtube.com/@techde',
  engagementRate: 4.2,
}

describe('NicheCard', () => {
  it('free tier: blurred elements present, no channel link, no engagement badge, lock icon shown', () => {
    render(<NicheCard data={baseData} userTier="free" rank={1} />)

    // No <a> tag — channel name is blurred text, not a link
    expect(screen.queryByRole('link')).toBeNull()

    // At least one element has blur applied
    const blurred = document.querySelector('[style*="blur"]')
    expect(blurred).not.toBeNull()

    // No engagement rate badge (undefined for free tier)
    expect(screen.queryByText(/eng/)).toBeNull()

    // Lock icon present next to channel name
    expect(screen.getByText('🔒')).toBeTruthy()
  })

  it('basic tier: channel name is a link, virality badge unblurred, engagement badge present', () => {
    render(<NicheCard data={basicData} userTier="basic" rank={1} />)

    // Channel name is an <a> link pointing to channelUrl
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://youtube.com/@techde')

    // Virality badge visible and not blurred
    const viralityEl = screen.getByText(/Excellent/i)
    expect(viralityEl).not.toHaveStyle('filter: blur(5px)')

    // Engagement rate badge present
    expect(screen.getByText(/eng/)).toBeTruthy()
  })

  it('skeleton: renders without errors, contains animate-pulse elements', () => {
    render(<NicheCardSkeleton />)
    const pulseEls = document.querySelectorAll('.animate-pulse')
    expect(pulseEls.length).toBeGreaterThan(0)
  })
})
