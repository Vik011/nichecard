/** @jest-environment jsdom */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { DailyFreeModal } from './DailyFreeModal'
import { COPY } from '@/components/landing/copy'

jest.mock('@/lib/supabase/queries', () => ({
  fetchNicheById: jest.fn(),
  fetchSpikeHistory: jest.fn().mockResolvedValue([]),
  fetchRelatedNiches: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/lib/supabase/savedNiches', () => ({
  fetchSavedNicheIds: jest.fn().mockResolvedValue(new Set()),
}))

jest.mock('@/lib/context/UserContext', () => ({
  useUser: () => ({ tier: 'free', userId: 'u-1', loading: false }),
}))

import { fetchNicheById } from '@/lib/supabase/queries'

const mockedFetchNicheById = fetchNicheById as jest.MockedFunction<typeof fetchNicheById>

const fakeNiche = {
  id: 'sr-1',
  channelName: 'Pinned Channel',
  youtubeChannelId: 'UC-pin',
  nicheLabel: 'AI Tutorials',
  contentType: 'longform' as const,
  channelCreatedAt: '2023-01-01T00:00:00Z',
  videoCount: 42,
  subscriberCount: 5000,
  subscriberRange: '1K–10K',
  spikeMultiplier: 3.2,
  opportunityScore: 72,
  viralityRating: 'high' as const,
  language: 'en' as const,
} as never

describe('DailyFreeModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedFetchNicheById.mockResolvedValue(fakeNiche)
  })

  it('renders nothing when open=false', () => {
    const { container } = render(
      <DailyFreeModal open={false} todayPinId="sr-1" copy={COPY.en} onClose={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('fetches and renders today’s pin when open=true', async () => {
    render(
      <DailyFreeModal open todayPinId="sr-1" copy={COPY.en} onClose={() => {}} />,
    )
    await waitFor(() => expect(mockedFetchNicheById).toHaveBeenCalledWith('sr-1'))
    expect(await screen.findByText(/Pinned Channel/)).toBeInTheDocument()
  })

  it('calls onClose when the user clicks the close button', async () => {
    const onClose = jest.fn()
    render(
      <DailyFreeModal open todayPinId="sr-1" copy={COPY.en} onClose={onClose} />,
    )
    const closeButton = await screen.findByRole('button', { name: /close/i })
    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalled()
  })
})
