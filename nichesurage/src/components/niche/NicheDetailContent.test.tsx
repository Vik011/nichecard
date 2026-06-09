import { render, screen } from '@testing-library/react'
import * as mockReact from 'react'
import { NicheDetailContent } from './NicheDetailContent'
import { COPY } from '@/components/landing/copy'
import type { NicheCardData } from '@/lib/types'

// Stub the scan_result_id / score / history-driven children with marker
// elements so the test can assert which sections render WITHOUT triggering
// their on-mount fetches. Each marker is wrapped in its own <div> so getByText
// matches it exactly. `mockReact` is the one out-of-scope ref jest's hoist
// guard allows (mock-prefixed); using createElement avoids JSX-in-factory.
jest.mock('@/lib/supabase/savedNiches', () => ({ saveNiche: jest.fn(), unsaveNiche: jest.fn() }))
jest.mock('@/lib/demo/useFreeDemoState', () => ({ useFreeDemoState: () => 'not-demo' }))
jest.mock('@/components/niche/FreeDemoBanner', () => ({ FreeDemoBanner: () => mockReact.createElement('div', null, 'FREE_DEMO_BANNER') }))
jest.mock('@/components/niche/PerformanceChart', () => ({ PerformanceChart: () => mockReact.createElement('div', null, 'PERF_CHART') }))
jest.mock('@/components/niche/HealthCheckInline', () => ({ HealthCheckInline: () => mockReact.createElement('div', null, 'HEALTH_CHECK') }))
jest.mock('@/components/niche/AIContentAngles', () => ({ AIContentAngles: () => mockReact.createElement('div', null, 'AI_ANGLES') }))
jest.mock('@/components/niche/ChannelVideoGrid', () => ({ ChannelVideoGrid: () => mockReact.createElement('div', null, 'VIDEO_GRID') }))
jest.mock('@/components/niche/RelatedNiches', () => ({ RelatedNiches: () => mockReact.createElement('div', null, 'RELATED') }))

const copy = COPY.en

const catalogNiche: NicheCardData = {
  id: 'wl:UCcat',
  youtubeChannelId: 'UCcat',
  contentType: 'longform',
  channelCreatedAt: '', // empty → ageMonths would be NaN if rendered
  videoCount: 120,
  subscriberCount: 42000,
  subscriberRange: '10K–50K',
  spikeMultiplier: 0,
  opportunityScore: 0,
  viralityRating: 'average',
  language: 'en',
  channelName: 'Catalog Channel',
  nicheLabel: 'Faceless History',
  lastUploadAt: '2026-06-01T00:00:00Z',
  catalogOnly: true,
  spikingNow: false,
}

const enrichedNiche: NicheCardData = {
  ...catalogNiche,
  id: 'sr-1',
  channelCreatedAt: '2024-01-01T00:00:00Z',
  spikeMultiplier: 4.2,
  opportunityScore: 82,
  catalogOnly: undefined,
}

describe('NicheDetailContent — catalogOnly guard (PR 4)', () => {
  it('does not leak fake score / WEAK / 0× spike / NaN for a catalog card', () => {
    render(<NicheDetailContent niche={catalogNiche} history={[]} tier="premium" copy={copy} />)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    expect(screen.queryByText('WEAK')).not.toBeInTheDocument()
    expect(screen.queryByText(/0×/)).not.toBeInTheDocument()
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
  })

  it('does not render scan-id / score / history sections for a catalog card', () => {
    render(<NicheDetailContent niche={catalogNiche} history={[]} tier="premium" copy={copy} />)
    expect(screen.queryByText('HEALTH_CHECK')).not.toBeInTheDocument()
    expect(screen.queryByText('AI_ANGLES')).not.toBeInTheDocument()
    expect(screen.queryByText('PERF_CHART')).not.toBeInTheDocument()
    expect(screen.queryByText('FREE_DEMO_BANNER')).not.toBeInTheDocument()
  })

  it('does not render a bookmark button for a wl: catalog card', () => {
    render(
      <NicheDetailContent
        niche={catalogNiche}
        history={[]}
        tier="premium"
        copy={copy}
        isSaved={false}
        savedCount={0}
        onBookmarkToggle={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /save niche/i })).not.toBeInTheDocument()
  })

  it('still renders honest catalog + channel content', () => {
    render(<NicheDetailContent niche={catalogNiche} history={[]} tier="premium" copy={copy} />)
    expect(screen.getByText('Catalog Channel')).toBeInTheDocument()
    expect(screen.getByText('10K–50K')).toBeInTheDocument() // subscriber range
    expect(screen.getByText('120')).toBeInTheDocument() // video count
    expect(screen.getByText('VIDEO_GRID')).toBeInTheDocument()
    expect(screen.getByText('RELATED')).toBeInTheDocument()
  })

  it('regular (non-catalog) niche still renders the score hero + AI sections', () => {
    render(<NicheDetailContent niche={enrichedNiche} history={[]} tier="premium" copy={copy} />)
    expect(screen.getByText('82')).toBeInTheDocument() // score hero
    expect(screen.getByText('HEALTH_CHECK')).toBeInTheDocument()
    expect(screen.getByText('AI_ANGLES')).toBeInTheDocument()
    expect(screen.getByText('PERF_CHART')).toBeInTheDocument()
  })
})
