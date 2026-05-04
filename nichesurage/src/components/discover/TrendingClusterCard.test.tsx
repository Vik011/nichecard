import { render, screen } from '@testing-library/react'
import { TrendingClusterCard } from './TrendingClusterCard'
import type { TrendClusterCard as Card } from '@/lib/types/trend'

const baseCard: Card = {
  id: '42',
  label: 'AI side hustles 2026',
  category: 'ai_tools',
  narrativeArchetypeLabel: 'Income blueprint',
  videoCount: 12,
  channelCount: 8,
  avgTrendScore: 76.4,
  isMegaCluster: false,
  megaCategories: [],
  sampleThumbnails: [
    'https://img/v1.jpg', 'https://img/v2.jpg', 'https://img/v3.jpg', 'https://img/v4.jpg',
  ],
  sampleTitles: ['t1', 't2', 't3', 't4'],
  lastUpdatedAt: '2026-05-04T12:00:00Z',
}

describe('TrendingClusterCard', () => {
  it('renders label, archetype, and counts', () => {
    render(<TrendingClusterCard card={baseCard} />)
    expect(screen.getByText('AI side hustles 2026')).toBeInTheDocument()
    expect(screen.getByText(/Income blueprint/)).toBeInTheDocument()
    // sub-line: "{channelCount} channels · {videoCount} videos · score {avgTrendScore.toFixed(1)}"
    expect(screen.getByText(/8 channels/)).toBeInTheDocument()
    expect(screen.getByText(/12 videos/)).toBeInTheDocument()
    expect(screen.getByText(/76\.4/)).toBeInTheDocument()
  })

  it('shows the cross-niche badge for mega clusters', () => {
    render(<TrendingClusterCard card={{ ...baseCard, isMegaCluster: true }} />)
    expect(screen.getByText(/Cross-niche/i)).toBeInTheDocument()
  })

  it('does NOT render the cross-niche badge for normal clusters', () => {
    render(<TrendingClusterCard card={baseCard} />)
    expect(screen.queryByText(/Cross-niche/i)).toBeNull()
  })

  it('navigates to /discover?cluster={id} via the wrapping link', () => {
    render(<TrendingClusterCard card={baseCard} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/discover?cluster=42')
  })

  it('renders gracefully with empty thumbnails (no broken <img> with empty src)', () => {
    render(<TrendingClusterCard card={{ ...baseCard, sampleThumbnails: [], sampleTitles: [] }} />)
    const imgs = screen.queryAllByRole('img')
    for (const img of imgs) {
      expect(img.getAttribute('src')).not.toBe('')
    }
  })
})
