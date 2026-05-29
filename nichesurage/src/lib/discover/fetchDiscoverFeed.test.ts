import { fetchDiscoverFeed } from './fetchDiscoverFeed'
import { createClient } from '@/lib/supabase/client'

jest.mock('@/lib/supabase/client')

type Resolved = { data: unknown; error: unknown }

interface Chain {
  select: jest.Mock
  gte: jest.Mock
  in: jest.Mock
  is: jest.Mock
  eq: jest.Mock
  order: jest.Mock
  limit: jest.Mock
  then: (cb: (r: Resolved) => unknown) => Promise<unknown>
}

function makeChain(resolved: Resolved): Chain {
  const chain: Partial<Chain> = {}
  const ret = () => chain as Chain
  // Per-method jest.fns (not one shared passthrough) so tests can assert
  // which query predicates were applied (e.g. the faceless_verdict filter).
  chain.select = jest.fn(ret)
  chain.gte = jest.fn(ret)
  chain.in = jest.fn(ret)
  chain.is = jest.fn(ret)
  chain.eq = jest.fn(ret)
  chain.order = jest.fn(ret)
  chain.limit = jest.fn(ret)
  chain.then = (onFulfilled) => Promise.resolve(resolved).then(onFulfilled)
  return chain as Chain
}

interface MockSetup {
  watchlist?: Resolved
  scanResults?: Resolved
}

// Returns the chains created per table so tests can assert query predicates.
function setupMock(setup: MockSetup): { cwChains: Chain[]; scanChains: Chain[] } {
  const cwChains: Chain[] = []
  const scanChains: Chain[] = []
  ;(createClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'channels_watchlist') {
        const c = makeChain(setup.watchlist ?? { data: [], error: null })
        cwChains.push(c)
        return c
      }
      if (table === 'scan_results_latest') {
        const c = makeChain(setup.scanResults ?? { data: [], error: null })
        scanChains.push(c)
        return c
      }
      return makeChain({ data: [], error: null })
    }),
  })
  return { cwChains, scanChains }
}

// Minimal fixture matching DbScanResult shape that mapRow expects.
function fixtureScanRow(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? 'sr-1',
    youtube_channel_id: overrides.youtube_channel_id ?? 'UC1',
    channel_name: overrides.channel_name ?? 'Test Channel',
    channel_url: overrides.channel_url ?? 'https://youtube.com/@test',
    channel_created_at: overrides.channel_created_at ?? '2025-01-01',
    video_count: overrides.video_count ?? 50,
    subscriber_count: overrides.subscriber_count ?? 5000,
    spike_multiplier: overrides.spike_multiplier ?? 1,
    opportunity_score: overrides.opportunity_score ?? 50,
    virality_rating: overrides.virality_rating ?? 'Average',
    language: overrides.language ?? 'en',
    niche_label: overrides.niche_label ?? '',
    content_type: overrides.content_type ?? 'longform',
    engagement_rate: overrides.engagement_rate ?? 0.01,
    views_avg: overrides.views_avg ?? 1000,
    views_48h: overrides.views_48h ?? 1000,
    outlier_ratio: overrides.outlier_ratio ?? 1,
    is_spike: overrides.is_spike ?? false,
    outlier_video_title: overrides.outlier_video_title ?? null,
    outlier_video_views: overrides.outlier_video_views ?? null,
    cluster_id: overrides.cluster_id ?? null,
    seed_keyword: overrides.seed_keyword ?? null,
    hook_score: overrides.hook_score ?? null,
    avg_view_duration_pct: overrides.avg_view_duration_pct ?? null,
    search_volume: overrides.search_volume ?? null,
    competition_score: overrides.competition_score ?? null,
    scanned_at: overrides.scanned_at ?? '2026-05-06T00:00:00Z',
  }
}

describe('fetchDiscoverFeed — all mode', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('returns [] on empty scan_results', async () => {
    // Faceless channels exist (gate passes), but they have no scan rows yet.
    setupMock({
      watchlist: { data: [{ youtube_channel_id: 'UCa' }], error: null },
      scanResults: { data: [], error: null },
    })
    const result = await fetchDiscoverFeed({ mode: 'all' })
    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  it('returns mapped rows when scan_results has entries', async () => {
    setupMock({
      watchlist: {
        data: [{ youtube_channel_id: 'UCa' }, { youtube_channel_id: 'UCb' }],
        error: null,
      },
      scanResults: {
        data: [
          fixtureScanRow({ id: 'a', youtube_channel_id: 'UCa', outlier_ratio: 9 }),
          fixtureScanRow({ id: 'b', youtube_channel_id: 'UCb', outlier_ratio: 5 }),
        ],
        error: null,
      },
    })
    const result = await fetchDiscoverFeed({ mode: 'all' })
    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(2)
    expect(result.data[0].id).toBe('a')
  })

  it('surfaces a generic error message when supabase errors', async () => {
    // Faceless gate passes so the flow reaches the scan_results query, which errors.
    setupMock({
      watchlist: { data: [{ youtube_channel_id: 'UCa' }], error: null },
      scanResults: { data: null, error: { message: 'boom' } },
    })
    const result = await fetchDiscoverFeed({ mode: 'all' })
    expect(result.error).toBe('Discover fetch failed')
    expect(result.data).toEqual([])
  })
})

describe('fetchDiscoverFeed — hot mode', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('returns [] when watchlist has no recent rows', async () => {
    setupMock({ watchlist: { data: [], error: null } })
    const result = await fetchDiscoverFeed({ mode: 'hot' })
    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  it('sorts hot results by opportunity_score desc, tiebreaks by tier_entered_at desc (recent wins ties)', async () => {
    setupMock({
      watchlist: {
        data: [
          { youtube_channel_id: 'UCa', tier_entered_at: '2026-05-06T10:00:00Z' },
          { youtube_channel_id: 'UCb', tier_entered_at: '2026-05-05T10:00:00Z' },
          { youtube_channel_id: 'UCc', tier_entered_at: '2026-05-06T11:00:00Z' },
        ],
        error: null,
      },
      scanResults: {
        data: [
          // UCb has highest score (70), UCa middle (50), UCc lowest (30).
          // UCa and UCc are both within window; UCb is too. Pure score sort.
          fixtureScanRow({ id: 'b-row', youtube_channel_id: 'UCb', opportunity_score: 70, outlier_ratio: 1 }),
          fixtureScanRow({ id: 'a-row', youtube_channel_id: 'UCa', opportunity_score: 50, outlier_ratio: 9 }),
          fixtureScanRow({ id: 'c-row', youtube_channel_id: 'UCc', opportunity_score: 30, outlier_ratio: 12 }),
        ],
        error: null,
      },
    })
    const result = await fetchDiscoverFeed({ mode: 'hot' })
    expect(result.error).toBeNull()
    // Pure score desc — outlier_ratio doesn't matter, recency doesn't matter
    // when scores differ.
    expect(result.data.map((d) => d.id)).toEqual(['b-row', 'a-row', 'c-row'])
  })

  it('uses tier_entered_at as tiebreaker when opportunity_scores are equal', async () => {
    setupMock({
      watchlist: {
        data: [
          { youtube_channel_id: 'UCold', tier_entered_at: '2026-05-04T10:00:00Z' },
          { youtube_channel_id: 'UCnew', tier_entered_at: '2026-05-06T10:00:00Z' },
        ],
        error: null,
      },
      scanResults: {
        data: [
          fixtureScanRow({ id: 'old-row', youtube_channel_id: 'UCold', opportunity_score: 50 }),
          fixtureScanRow({ id: 'new-row', youtube_channel_id: 'UCnew', opportunity_score: 50 }),
        ],
        error: null,
      },
    })
    const result = await fetchDiscoverFeed({ mode: 'hot' })
    expect(result.data.map((d) => d.id)).toEqual(['new-row', 'old-row'])
  })

  it('skips channels in watchlist that have no scan_results yet', async () => {
    setupMock({
      watchlist: {
        data: [
          { youtube_channel_id: 'UCa', tier_entered_at: '2026-05-06T10:00:00Z' },
          { youtube_channel_id: 'UC_no_scan', tier_entered_at: '2026-05-06T11:00:00Z' },
        ],
        error: null,
      },
      scanResults: {
        data: [
          fixtureScanRow({ id: 'a-row', youtube_channel_id: 'UCa', outlier_ratio: 3 }),
        ],
        error: null,
      },
    })
    const result = await fetchDiscoverFeed({ mode: 'hot' })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('a-row')
  })

  it('returns generic error when watchlist query fails', async () => {
    setupMock({ watchlist: { data: null, error: { message: 'boom' } } })
    const result = await fetchDiscoverFeed({ mode: 'hot' })
    expect(result.error).toBe('Discover fetch failed')
  })
})

describe('fetchDiscoverFeed — faceless filter (faceless-only feed)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('all mode returns [] when no channel has a faceless verdict (face/uncertain excluded)', async () => {
    // No faceless channels in the watchlist gate, but scan_results has a row.
    // The feed must NOT surface it — face/uncertain channels never appear.
    setupMock({
      watchlist: { data: [], error: null },
      scanResults: {
        data: [fixtureScanRow({ id: 'face-row', youtube_channel_id: 'UCface' })],
        error: null,
      },
    })
    const result = await fetchDiscoverFeed({ mode: 'all' })
    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  it('all mode gates scan_results on channels_watchlist faceless_verdict=faceless', async () => {
    const { cwChains } = setupMock({
      watchlist: { data: [{ youtube_channel_id: 'UCa' }], error: null },
      scanResults: {
        data: [fixtureScanRow({ id: 'a', youtube_channel_id: 'UCa' })],
        error: null,
      },
    })
    await fetchDiscoverFeed({ mode: 'all' })
    expect(cwChains.length).toBeGreaterThan(0)
    expect(cwChains[0].eq.mock.calls).toContainEqual(['faceless_verdict', 'faceless'])
  })

  it('hot mode filters watchlist step-1 on faceless_verdict=faceless', async () => {
    const { cwChains } = setupMock({
      watchlist: {
        data: [{ youtube_channel_id: 'UCa', tier_entered_at: '2026-05-06T10:00:00Z' }],
        error: null,
      },
      scanResults: {
        data: [fixtureScanRow({ id: 'a', youtube_channel_id: 'UCa' })],
        error: null,
      },
    })
    await fetchDiscoverFeed({ mode: 'hot' })
    expect(cwChains.length).toBeGreaterThan(0)
    expect(cwChains[0].eq.mock.calls).toContainEqual(['faceless_verdict', 'faceless'])
  })
})
