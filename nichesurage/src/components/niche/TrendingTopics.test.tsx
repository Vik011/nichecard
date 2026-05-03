import { render, screen, waitFor } from '@testing-library/react'
import { TrendingTopics } from './TrendingTopics'
import * as queries from '@/lib/supabase/queries'

jest.mock('@/lib/supabase/queries')

let mockSearchParams = new URLSearchParams()
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}))

describe('TrendingTopics', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    mockSearchParams = new URLSearchParams()
  })

  it('renders cluster chips when fetch returns rows', async () => {
    (queries.fetchTrendingClusters as jest.Mock).mockResolvedValueOnce([
      { id: 'c1', label: 'Underground AI Automation', memberCount: 12, language: 'en', contentType: 'longform' },
      { id: 'c2', label: 'Faceless Stoic Productivity', memberCount: 7,  language: 'en', contentType: 'shorts' },
    ])
    render(<TrendingTopics eyebrow="Trending topics" />)
    await waitFor(() => {
      expect(screen.getByText('Underground AI Automation')).toBeInTheDocument()
      expect(screen.getByText('Faceless Stoic Productivity')).toBeInTheDocument()
    })
  })

  it('renders the empty hint when fetch returns []', async () => {
    (queries.fetchTrendingClusters as jest.Mock).mockResolvedValueOnce([])
    render(<TrendingTopics eyebrow="Trending topics" emptyHint="No clusters yet" />)
    await waitFor(() => {
      expect(screen.getByText('No clusters yet')).toBeInTheDocument()
    })
  })

  it('marks the active cluster as selected', async () => {
    (queries.fetchTrendingClusters as jest.Mock).mockResolvedValueOnce([
      { id: 'c1', label: 'Quiet Luxury Fashion', memberCount: 5, language: 'en', contentType: 'shorts' },
    ])
    render(<TrendingTopics eyebrow="Trending topics" activeClusterId="c1" />)
    await waitFor(() => {
      const link = screen.getByRole('listitem')
      expect(link.className).toMatch(/ring-glow-indigo/)
    })
  })

  it('preserves type=longform when building cluster href (regression: chips were dropping format)', async () => {
    mockSearchParams = new URLSearchParams('type=longform&channelAge=any')
    ;(queries.fetchTrendingClusters as jest.Mock).mockResolvedValueOnce([
      { id: 'c1', label: 'Stoic Mind Rewiring', memberCount: 24, language: 'en', contentType: 'longform' },
    ])
    render(<TrendingTopics eyebrow="Trending topics" />)
    await waitFor(() => {
      const link = screen.getByRole('listitem') as HTMLAnchorElement
      // href should contain BOTH cluster=c1 AND type=longform (and any other preserved params)
      expect(link.getAttribute('href')).toMatch(/cluster=c1/)
      expect(link.getAttribute('href')).toMatch(/type=longform/)
    })
  })

  it('builds cluster href with no extra params when none are present', async () => {
    mockSearchParams = new URLSearchParams()
    ;(queries.fetchTrendingClusters as jest.Mock).mockResolvedValueOnce([
      { id: 'c1', label: 'Faceless AI Income Blueprint', memberCount: 17, language: 'en', contentType: 'shorts' },
    ])
    render(<TrendingTopics eyebrow="Trending topics" />)
    await waitFor(() => {
      const link = screen.getByRole('listitem') as HTMLAnchorElement
      expect(link.getAttribute('href')).toBe('/discover?cluster=c1')
    })
  })
})
