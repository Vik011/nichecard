import { render, screen, waitFor } from '@testing-library/react'
import { ChannelVideoGrid } from './ChannelVideoGrid'
import { COPY } from '@/components/landing/copy'
import type { ChannelVideo } from '@/lib/types'

const copy = COPY.en
const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
})

const sampleVideo: ChannelVideo = {
  id: 'vid123',
  title: 'A Catalog Channel Upload',
  thumbnail: 'https://i.ytimg.com/vi/vid123/hqdefault.jpg',
  viewCount: 12000,
  publishedAt: '2026-06-01T00:00:00Z',
}

function mockFetch(value: { ok: boolean; status?: number; json: () => Promise<unknown> }) {
  global.fetch = jest.fn().mockResolvedValue(value) as unknown as typeof fetch
}

describe('ChannelVideoGrid', () => {
  it('default: non-OK fetch shows the red error (videosError)', async () => {
    mockFetch({ ok: false, status: 403, json: async () => ({ error: 'Upgrade required', paywall: true }) })
    render(<ChannelVideoGrid channelId="UCabc" copy={copy} />)
    await waitFor(() => {
      expect(screen.getByText(copy.videosError)).toBeInTheDocument()
    })
    expect(screen.getByText(copy.videosRetry)).toBeInTheDocument()
  })

  it('gracefulFailure: non-OK fetch shows the honest "unavailable" message, not the red error', async () => {
    mockFetch({ ok: false, status: 403, json: async () => ({ error: 'Upgrade required', paywall: true }) })
    render(<ChannelVideoGrid channelId="UCabc" copy={copy} gracefulFailure />)
    await waitFor(() => {
      expect(screen.getByText(copy.videosUnavailable)).toBeInTheDocument()
    })
    // PR 4.2: it's the distinct unavailable copy — NOT the red error, retry, or
    // the "no recent videos" empty copy (which would misattribute the failure).
    expect(screen.queryByText(copy.videosError)).not.toBeInTheDocument()
    expect(screen.queryByText(copy.videosRetry)).not.toBeInTheDocument()
    expect(screen.queryByText(copy.videosEmpty)).not.toBeInTheDocument()
  })

  it('gracefulFailure: a genuine 200 with zero videos still shows videosEmpty (not unavailable)', async () => {
    mockFetch({ ok: true, json: async () => ({ videos: [], cached: false }) })
    render(<ChannelVideoGrid channelId="UCabc" copy={copy} gracefulFailure />)
    await waitFor(() => {
      expect(screen.getByText(copy.videosEmpty)).toBeInTheDocument()
    })
    expect(screen.queryByText(copy.videosUnavailable)).not.toBeInTheDocument()
    expect(screen.queryByText(copy.videosError)).not.toBeInTheDocument()
  })

  it('gracefulFailure: successful fetch still renders videos', async () => {
    mockFetch({ ok: true, json: async () => ({ videos: [sampleVideo], cached: false }) })
    render(<ChannelVideoGrid channelId="UCabc" copy={copy} gracefulFailure />)
    await waitFor(() => {
      expect(screen.getByText('A Catalog Channel Upload')).toBeInTheDocument()
    })
    expect(screen.queryByText(copy.videosEmpty)).not.toBeInTheDocument()
    expect(screen.queryByText(copy.videosUnavailable)).not.toBeInTheDocument()
    expect(screen.queryByText(copy.videosError)).not.toBeInTheDocument()
  })
})
