import { render, screen, waitFor } from '@testing-library/react'
import { TrendingTopics } from './TrendingTopics'
import * as queries from '@/lib/supabase/queries'

jest.mock('@/lib/supabase/queries')

describe('TrendingTopics', () => {
  beforeEach(() => jest.resetAllMocks())

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
})
