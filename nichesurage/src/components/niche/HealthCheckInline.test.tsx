import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { HealthCheckInline } from './HealthCheckInline'
import { COPY } from '@/components/landing/copy'

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
})

const mockResponse = {
  score: 67,
  components: { spike: 18, opportunity: 20, engagement: 14, virality: 8, saturation: 7 },
  verdict: 'Solid early-stage niche with room to grow.',
  cached: false,
}

describe('HealthCheckInline', () => {
  it('renders locked teaser for free tier', () => {
    render(<HealthCheckInline scanResultId="scan-1" userTier="free" copy={COPY.en} />)
    expect(screen.getByText(/Premium feature/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /upgrade/i }).getAttribute('href')).toBe('/pricing')
  })

  it('does NOT call fetch for free tier (locked teaser path)', () => {
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy as unknown as typeof fetch
    render(<HealthCheckInline scanResultId="scan-1" userTier="free" copy={COPY.en} />)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('Sprint A.7: basic tier fetches like premium and renders result', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as unknown as typeof fetch

    render(<HealthCheckInline scanResultId="scan-1" userTier="basic" copy={COPY.en} />)
    await waitFor(() => {
      expect(screen.getByText('67')).toBeTruthy()
    })
  })

  it('Sprint A.7: basic tier shows quota-exhausted UI on 429 daily_limit', async () => {
    const resetAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString()
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: 'daily_limit', tier: 'basic', usedToday: 1, limit: 1, resetAt }),
    }) as unknown as typeof fetch

    render(<HealthCheckInline scanResultId="scan-1" userTier="basic" copy={COPY.en} />)
    await waitFor(() => {
      expect(screen.getByText(/Daily deep-dive used/i)).toBeTruthy()
    })
    expect(screen.getByRole('link', { name: /upgrade to premium/i })).toBeTruthy()
  })

  it('renders score, verdict, and 5 component bars for premium', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as unknown as typeof fetch

    render(<HealthCheckInline scanResultId="scan-1" userTier="premium" copy={COPY.en} />)
    await waitFor(() => {
      expect(screen.getByText('67')).toBeTruthy()
    })
    expect(screen.getByText(/Solid early-stage niche/)).toBeTruthy()
    expect(screen.getByText('Spike')).toBeTruthy()
    expect(screen.getByText('Opportunity')).toBeTruthy()
    expect(screen.getByText('Engagement')).toBeTruthy()
    expect(screen.getByText('Virality')).toBeTruthy()
    expect(screen.getByText('Room to grow')).toBeTruthy()
  })

  it('renders error state with Retry on fetch failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    }) as unknown as typeof fetch

    render(<HealthCheckInline scanResultId="scan-1" userTier="premium" copy={COPY.en} />)
    await waitFor(() => {
      expect(screen.getByText(/Failed to load health check/i)).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
  })
})
