import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { AIContentAngles } from './AIContentAngles'
import { COPY } from '@/components/landing/copy'
import type { ContentAngle } from '@/lib/types'

const mockAngles: ContentAngle[] = [
  { title: 'How tiny channels go viral with this exact format', hook: 'Most small channels die in the first 90 days.', format: 'shorts', why: 'Spike pattern shows new entrants outperforming.' },
  { title: 'The 3-second rule that doubled retention', hook: 'You have three seconds before they swipe.', format: 'shorts', why: 'High spike multiplier rewards aggressive hooks.' },
  { title: 'I copied this niche playbook for 30 days', hook: 'Here is what actually moved the needle.', format: 'shorts', why: 'Opportunity score above 60 signals replicable wins.' },
  { title: 'Why this audience watches shorts on repeat', hook: 'They watch the same Short fifty times.', format: 'shorts', why: 'High engagement suggests rewatchable format.' },
  { title: 'Build a 100k channel in this exact niche', hook: 'Pick the boring niche, win the boring war.', format: 'shorts', why: 'Subscriber range proves room above current ceiling.' },
]

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
})

describe('AIContentAngles', () => {
  it('renders locked teaser for free tier with Upgrade button to /pricing', () => {
    render(<AIContentAngles scanResultId="scan-1" userTier="free" copy={COPY.en} />)
    expect(screen.getByText(/Premium feature/i)).toBeTruthy()
    const upgradeLink = screen.getByRole('link', { name: /upgrade/i })
    expect(upgradeLink.getAttribute('href')).toBe('/pricing')
  })

  it('renders locked teaser for basic tier (also non-premium)', () => {
    render(<AIContentAngles scanResultId="scan-1" userTier="basic" copy={COPY.en} />)
    expect(screen.getByText(/Premium feature/i)).toBeTruthy()
  })

  it('does NOT call fetch when user is not premium', () => {
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy as unknown as typeof fetch
    render(<AIContentAngles scanResultId="scan-1" userTier="free" copy={COPY.en} />)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fetches and renders 5 angle cards for premium tier', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ angles: mockAngles, cached: false }),
    }) as unknown as typeof fetch

    render(<AIContentAngles scanResultId="scan-1" userTier="premium" copy={COPY.en} />)
    await waitFor(() => {
      expect(screen.getAllByTestId('angle-card')).toHaveLength(5)
    })
    expect(screen.getByText(/tiny channels go viral/i)).toBeTruthy()
    expect(screen.getByText(/Pick the boring niche/i)).toBeTruthy()
  })

  it('renders error state with Retry button on fetch failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'AI returned invalid format. Try again.' }),
    }) as unknown as typeof fetch

    render(<AIContentAngles scanResultId="scan-1" userTier="premium" copy={COPY.en} />)
    await waitFor(() => {
      expect(screen.getByText(/Failed to generate angles/i)).toBeTruthy()
    })
    const retryBtn = screen.getByRole('button', { name: /try again/i })
    expect(retryBtn).toBeTruthy()
    fireEvent.click(retryBtn)
  })
})
