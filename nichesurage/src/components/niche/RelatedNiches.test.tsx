import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { RelatedNiches } from './RelatedNiches'
import { COPY } from '@/components/landing/copy'
import type { NicheCardData } from '@/lib/types'

jest.mock('@/lib/supabase/queries', () => ({
  fetchRelatedNiches: jest.fn(),
  fetchSpikeHistory: jest.fn().mockResolvedValue([]),
}))

const { fetchRelatedNiches } = jest.requireMock('@/lib/supabase/queries')

const baseNiche: NicheCardData = {
  id: 'n1',
  youtubeChannelId: 'UCabc',
  channelName: 'Test Channel',
  channelHandle: '@test',
  channelUrl: 'https://youtube.com/@test',
  thumbnailUrl: '',
  language: 'en',
  category: 'gaming',
  subscriberCount: 100000,
  subscriberRange: '100K',
  videoCount: 250,
  spikeMultiplier: 5,
  opportunityScore: 70,
  channelCreatedAt: '2024-01-01T00:00:00Z',
  contentType: 'longform',
  viralityRating: 'good',
} as unknown as NicheCardData

const related: NicheCardData = {
  ...baseNiche,
  id: 'n2',
  channelName: 'Related Channel',
  youtubeChannelId: 'UCdef',
}

describe('RelatedNiches inline replace', () => {
  beforeEach(() => {
    fetchRelatedNiches.mockReset()
    fetchRelatedNiches.mockResolvedValue([related])
  })

  it('calls onCardClick with the niche id when a card is clicked', async () => {
    const onCardClick = jest.fn()
    render(<RelatedNiches niche={baseNiche} userTier="premium" copy={COPY.en} onCardClick={onCardClick} />)

    await waitFor(() => expect(screen.getByText('Related Channel')).toBeInTheDocument())

    // With onCardClick defined, NicheCard renders as a <button>
    const card = screen.getByText('Related Channel').closest('button, a')
    expect(card).not.toBeNull()
    fireEvent.click(card!)

    expect(onCardClick).toHaveBeenCalledWith('n2')
  })

  it('falls back to default Link navigation when onCardClick is undefined', async () => {
    render(<RelatedNiches niche={baseNiche} userTier="premium" copy={COPY.en} />)
    await waitFor(() => expect(screen.getByText('Related Channel')).toBeInTheDocument())

    // Without onCardClick, NicheCard renders as a <Link> (anchor tag)
    const link = screen.getByText('Related Channel').closest('a')
    expect(link).not.toBeNull()
  })

  it('renders related cards locked for free tier (no data leak)', async () => {
    const onCardClick = jest.fn()
    render(<RelatedNiches niche={baseNiche} userTier="free" copy={COPY.en} onCardClick={onCardClick} />)

    // Wait for the related niche to load.
    await waitFor(() => expect(fetchRelatedNiches).toHaveBeenCalled())

    // Locked NicheCards render with aria-label "Locked niche - upgrade to unlock".
    // No onCardClick is wired up for locked cards (NicheCard routes to onLockedClick).
    await waitFor(() => {
      expect(screen.getByLabelText(/locked niche/i)).toBeInTheDocument()
    })
  })
})
