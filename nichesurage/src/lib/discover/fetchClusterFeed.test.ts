import { fetchClusterFeed } from './fetchClusterFeed'
import { createClient } from '@/lib/supabase/client'

jest.mock('@/lib/supabase/client')

// We model only the chains fetchClusterFeed actually uses. Each `from()` call
// returns its own builder instance so independent queries don't share state.
type Resolved = { data: unknown; error: unknown }

interface ClusterChain {
  select: jest.Mock
  gte: jest.Mock
  not: jest.Mock
  eq: jest.Mock
  order: jest.Mock
  limit: jest.Mock
  in: jest.Mock
  then: (cb: (r: Resolved) => unknown) => Promise<unknown>
}

function makeChain(resolved: Resolved): ClusterChain {
  const chain: Partial<ClusterChain> = {}
  const passthrough = jest.fn(() => chain as ClusterChain)
  chain.select = passthrough
  chain.gte = passthrough
  chain.not = passthrough
  chain.eq = passthrough
  chain.order = passthrough
  chain.limit = passthrough
  chain.in = passthrough
  // Make the chain awaitable: `await chain` resolves to {data,error}.
  chain.then = (onFulfilled) => Promise.resolve(resolved).then(onFulfilled)
  return chain as ClusterChain
}

interface MockSetup {
  clusters: Resolved
  members: Resolved
  snapshots: Resolved
  metricsLifecycle?: Resolved
}

function setupSupabaseMock(setup: MockSetup) {
  const fromMock = jest.fn((table: string) => {
    if (table === 'trend_clusters')         return makeChain(setup.clusters)
    if (table === 'trend_cluster_members')  return makeChain(setup.members)
    if (table === 'video_snapshots')        return makeChain(setup.snapshots)
    if (table === 'video_metrics')          return makeChain(setup.metricsLifecycle ?? { data: [], error: null })
    return makeChain({ data: [], error: null })
  })
  ;(createClient as jest.Mock).mockReturnValue({ from: fromMock })
  return { fromMock }
}

describe('fetchClusterFeed', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    ;(console.error as jest.Mock).mockRestore?.()
  })

  it('returns [] when clusters table is empty', async () => {
    setupSupabaseMock({
      clusters: { data: [], error: null },
      members: { data: [], error: null },
      snapshots: { data: [], error: null },
    })
    const out = await fetchClusterFeed({})
    expect(out).toEqual([])
  })

  it('shapes a single non-mega cluster with 4 sample thumbnails', async () => {
    setupSupabaseMock({
      clusters: {
        data: [{
          id: 42,
          label: 'AI side hustles 2026',
          category: 'ai_tools',
          video_count: 12,
          channel_count: 8,
          avg_trend_score: 76.4,
          is_mega_cluster: false,
          mega_cluster_categories: null,
          last_updated_at: '2026-05-04T12:00:00Z',
          narrative_archetypes: { display_label: 'Income blueprint' },
        }],
        error: null,
      },
      members: {
        data: [
          { cluster_id: 42, video_id: 'v1' },
          { cluster_id: 42, video_id: 'v2' },
          { cluster_id: 42, video_id: 'v3' },
          { cluster_id: 42, video_id: 'v4' },
          { cluster_id: 42, video_id: 'v5' },  // 5th — must be dropped (cap at 4)
        ],
        error: null,
      },
      snapshots: {
        data: [
          { video_id: 'v1', thumbnail_url: 'https://img/v1.jpg', title: 'Title 1', scanned_at: '2026-05-04T12:00:00Z' },
          { video_id: 'v2', thumbnail_url: 'https://img/v2.jpg', title: 'Title 2', scanned_at: '2026-05-04T12:00:00Z' },
          { video_id: 'v3', thumbnail_url: 'https://img/v3.jpg', title: 'Title 3', scanned_at: '2026-05-04T12:00:00Z' },
          { video_id: 'v4', thumbnail_url: 'https://img/v4.jpg', title: 'Title 4', scanned_at: '2026-05-04T12:00:00Z' },
        ],
        error: null,
      },
    })
    const [card] = await fetchClusterFeed({})
    expect(card.id).toBe('42')
    expect(card.label).toBe('AI side hustles 2026')
    expect(card.category).toBe('ai_tools')
    expect(card.narrativeArchetypeLabel).toBe('Income blueprint')
    expect(card.videoCount).toBe(12)
    expect(card.channelCount).toBe(8)
    expect(card.avgTrendScore).toBeCloseTo(76.4)
    expect(card.isMegaCluster).toBe(false)
    expect(card.megaCategories).toEqual([])
    expect(card.sampleThumbnails).toHaveLength(4)
    expect(card.sampleThumbnails).toEqual([
      'https://img/v1.jpg', 'https://img/v2.jpg', 'https://img/v3.jpg', 'https://img/v4.jpg',
    ])
    expect(card.sampleTitles).toEqual(['Title 1', 'Title 2', 'Title 3', 'Title 4'])
  })

  it('preserves isMegaCluster=true and mega_cluster_categories', async () => {
    setupSupabaseMock({
      clusters: {
        data: [{
          id: 7,
          label: 'Election panic narrative',
          category: 'geopolitics_news',
          video_count: 30,
          channel_count: 22,
          avg_trend_score: 88.0,
          is_mega_cluster: true,
          mega_cluster_categories: ['geopolitics_news', 'finance', 'crypto'],
          last_updated_at: '2026-05-04T12:00:00Z',
          narrative_archetypes: null,
        }],
        error: null,
      },
      members: { data: [{ cluster_id: 7, video_id: 'v1' }], error: null },
      snapshots: { data: [], error: null },
    })
    const [card] = await fetchClusterFeed({})
    expect(card.isMegaCluster).toBe(true)
    expect(card.megaCategories).toEqual(['geopolitics_news', 'finance', 'crypto'])
    expect(card.narrativeArchetypeLabel).toBeUndefined()
  })

  it('returns the card with empty sampleThumbnails when no members', async () => {
    setupSupabaseMock({
      clusters: {
        data: [{
          id: 100,
          label: 'Niche with no scanned thumbnails yet',
          category: null,
          video_count: 5,
          channel_count: 3,
          avg_trend_score: 42,
          is_mega_cluster: false,
          mega_cluster_categories: null,
          last_updated_at: '2026-05-04T12:00:00Z',
          narrative_archetypes: null,
        }],
        error: null,
      },
      members: { data: [], error: null },
      snapshots: { data: [], error: null },
    })
    const [card] = await fetchClusterFeed({})
    expect(card.sampleThumbnails).toEqual([])
    expect(card.sampleTitles).toEqual([])
  })

  it('falls back to "(unlabeled cluster)" when label is null', async () => {
    setupSupabaseMock({
      clusters: {
        data: [{
          id: 9,
          label: null,
          category: 'finance',
          video_count: 6,
          channel_count: 5,
          avg_trend_score: 55,
          is_mega_cluster: false,
          mega_cluster_categories: null,
          last_updated_at: '2026-05-04T12:00:00Z',
          narrative_archetypes: null,
        }],
        error: null,
      },
      members: { data: [], error: null },
      snapshots: { data: [], error: null },
    })
    const [card] = await fetchClusterFeed({})
    expect(card.label).toBe('(unlabeled cluster)')
  })

  it('returns [] and console.errors on cluster query failure', async () => {
    setupSupabaseMock({
      clusters: { data: null, error: { message: 'boom' } },
      members: { data: [], error: null },
      snapshots: { data: [], error: null },
    })
    const out = await fetchClusterFeed({})
    expect(out).toEqual([])
    expect(console.error).toHaveBeenCalled()
  })

  it('passes category filter through to the trend_clusters query', async () => {
    const eqMock = jest.fn().mockReturnThis()
    const chain = {
      select: jest.fn().mockReturnThis(),
      gte:    jest.fn().mockReturnThis(),
      eq:     eqMock,
      order:  jest.fn().mockReturnThis(),
      limit:  jest.fn().mockReturnThis(),
      then: (cb: (r: Resolved) => unknown) => Promise.resolve({ data: [], error: null }).then(cb),
    }
    const fromMock = jest.fn((table: string) => {
      if (table === 'trend_clusters') return chain
      return makeChain({ data: [], error: null })
    })
    ;(createClient as jest.Mock).mockReturnValue({ from: fromMock })

    await fetchClusterFeed({ category: 'finance' })
    expect(eqMock).toHaveBeenCalledWith('category', 'finance')
  })
})
