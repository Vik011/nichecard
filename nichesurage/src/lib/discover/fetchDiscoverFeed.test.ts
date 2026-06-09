import { fetchDiscoverFeed } from './fetchDiscoverFeed'
import { createClient } from '@/lib/supabase/client'

jest.mock('@/lib/supabase/client')

type Resolved = { data: unknown; error: unknown }

interface Chain {
  select: jest.Mock
  gte: jest.Mock
  in: jest.Mock
  is: jest.Mock
  not: jest.Mock
  eq: jest.Mock
  order: jest.Mock
  limit: jest.Mock
  then: (cb: (r: Resolved) => unknown) => Promise<unknown>
}

function makeChain(resolved: Resolved): Chain {
  const chain: Partial<Chain> = {}
  const ret = () => chain as Chain
  // Honor `.not(col, 'is', null)` (IS NOT NULL) so the mock reflects the
  // server-side filter — rows missing that column are dropped. PR 4's Segment 2
  // uses these guards to exclude channels without populated catalog fields.
  const notNullCols: string[] = []
  // Per-method jest.fns (not one shared passthrough) so tests can assert
  // which query predicates were applied (e.g. the faceless_verdict filter).
  chain.select = jest.fn(ret)
  chain.gte = jest.fn(ret)
  chain.in = jest.fn(ret)
  chain.is = jest.fn(ret)
  chain.not = jest.fn((col: string, op: string, val: unknown) => {
    if (op === 'is' && val === null) notNullCols.push(col)
    return chain as Chain
  })
  chain.eq = jest.fn(ret)
  chain.order = jest.fn(ret)
  chain.limit = jest.fn(ret)
  chain.then = (onFulfilled) => {
    let data = resolved.data
    if (Array.isArray(data) && notNullCols.length > 0) {
      data = (data as Array<Record<string, unknown>>).filter((row) =>
        notNullCols.every((c) => row[c] !== null && row[c] !== undefined),
      )
    }
    return Promise.resolve({ data, error: resolved.error }).then(onFulfilled)
  }
  return chain as Chain
}

interface MockSetup {
  // PR 4: array form lets a test vary the per-call channels_watchlist result
  // (gate call → Segment 2 call → attachCategories call) to exercise fail-soft.
  watchlist?: Resolved | Resolved[]
  scanResults?: Resolved
  momentum?: Resolved
}

// Returns the chains created per table so tests can assert query predicates.
function setupMock(setup: MockSetup): {
  cwChains: Chain[]
  scanChains: Chain[]
  momChains: Chain[]
} {
  const cwChains: Chain[] = []
  const scanChains: Chain[] = []
  const momChains: Chain[] = []
  let cwCall = 0
  ;(createClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'channels_watchlist') {
        const wl = Array.isArray(setup.watchlist)
          ? (setup.watchlist[cwCall] ?? setup.watchlist[setup.watchlist.length - 1] ?? { data: [], error: null })
          : (setup.watchlist ?? { data: [], error: null })
        cwCall++
        const c = makeChain(wl)
        cwChains.push(c)
        return c
      }
      if (table === 'scan_results_latest') {
        const c = makeChain(setup.scanResults ?? { data: [], error: null })
        scanChains.push(c)
        return c
      }
      if (table === 'channel_current_momentum') {
        const c = makeChain(setup.momentum ?? { data: [], error: null })
        momChains.push(c)
        return c
      }
      return makeChain({ data: [], error: null })
    }),
  })
  return { cwChains, scanChains, momChains }
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
    scanned_at: overrides.scanned_at ?? new Date(Date.now() - 3_600_000).toISOString(),
  }
}

// ISO timestamp N hours before now — for the Part A freshness-gate tests.
function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString()
}

// Minimal fixture matching a channel_current_momentum view row (ChannelMomentum
// shape). Defaults describe an eligible, above-floor (trend 80) channel.
function fixtureMomentumRow(overrides: Record<string, unknown> = {}) {
  return {
    youtube_channel_id: overrides.youtube_channel_id ?? 'UCa',
    content_type: overrides.content_type ?? 'longform',
    best_video_id: overrides.best_video_id ?? 'vid1',
    best_video_age_hours: overrides.best_video_age_hours ?? 100,
    last_metric_age_hours: overrides.last_metric_age_hours ?? 5,
    snapshot_count: overrides.snapshot_count ?? 3,
    trend_score: overrides.trend_score ?? 80,
    lifecycle_status: overrides.lifecycle_status ?? 'exploding',
    velocity_delta: overrides.velocity_delta ?? 1.5,
    views_per_hour: overrides.views_per_hour ?? 200,
    current_eligible: overrides.current_eligible ?? true,
    last_snapshot_at: overrides.last_snapshot_at ?? new Date().toISOString(),
  }
}

// PR 4: minimal channels_watchlist catalog row (WatchlistCatalogRow shape) for
// the Segment 2 union tests.
function fixtureWlRow(overrides: Record<string, unknown> = {}) {
  return {
    youtube_channel_id: overrides.youtube_channel_id ?? 'UCw',
    channel_name: overrides.channel_name ?? 'Catalog Ch',
    niche_label: overrides.niche_label ?? 'Faceless',
    content_type: overrides.content_type ?? 'longform',
    language: overrides.language ?? 'en',
    category: overrides.category ?? null,
    subscriber_count: overrides.subscriber_count ?? 10000,
    video_count: overrides.video_count ?? 80,
    last_upload_at: overrides.last_upload_at ?? '2026-06-01T00:00:00Z',
    first_discovered_at: overrides.first_discovered_at ?? '2026-05-01T00:00:00Z',
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

describe('fetchDiscoverFeed — all mode Segment 2 (PR 4 catalog backbone)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('appends catalog-only cards after the outlier (Segment 1) cards, no dupes', async () => {
    setupMock({
      watchlist: {
        data: [
          fixtureWlRow({ youtube_channel_id: 'UCa' }), // also in Segment 1
          fixtureWlRow({ youtube_channel_id: 'UCb', subscriber_count: 50000 }),
          fixtureWlRow({ youtube_channel_id: 'UCc', subscriber_count: 9000 }),
        ],
        error: null,
      },
      scanResults: {
        data: [fixtureScanRow({ id: 'a-row', youtube_channel_id: 'UCa', opportunity_score: 80 })],
        error: null,
      },
    })
    const result = await fetchDiscoverFeed({ surface: 'all' })
    expect(result.error).toBeNull()
    // Segment 1 (outlier) first, then catalog-only; UCa not duplicated.
    expect(result.data.map((d) => d.id)).toEqual(['a-row', 'wl:UCb', 'wl:UCc'])
    expect(result.data[0].catalogOnly).toBeUndefined()
    expect(result.data[1].catalogOnly).toBe(true)
    expect(result.data[2].catalogOnly).toBe(true)
  })

  it('queries the catalog-only ids with NOT-NULL guards + subscriber/upload ordering', async () => {
    const { cwChains } = setupMock({
      watchlist: {
        data: [fixtureWlRow({ youtube_channel_id: 'UCa' }), fixtureWlRow({ youtube_channel_id: 'UCb' })],
        error: null,
      },
      scanResults: {
        data: [fixtureScanRow({ id: 'a-row', youtube_channel_id: 'UCa' })],
        error: null,
      },
    })
    await fetchDiscoverFeed({ surface: 'all' })
    // cwChains[0] = gate; cwChains[1] = Segment 2 catalog query.
    const seg2 = cwChains[1]
    expect(seg2.in.mock.calls).toContainEqual(['youtube_channel_id', ['UCb']])
    expect(seg2.not.mock.calls).toContainEqual(['subscriber_count', 'is', null])
    expect(seg2.not.mock.calls).toContainEqual(['video_count', 'is', null])
    expect(seg2.not.mock.calls).toContainEqual(['last_upload_at', 'is', null])
    expect(seg2.order.mock.calls[0][0]).toBe('subscriber_count')
    expect(seg2.order.mock.calls[1][0]).toBe('last_upload_at')
  })

  it('fail-soft: a Segment 2 error never blanks Segment 1', async () => {
    setupMock({
      watchlist: [
        { data: [{ youtube_channel_id: 'UCa' }, { youtube_channel_id: 'UCb' }], error: null }, // gate
        { data: null, error: { message: 'boom' } }, // Segment 2 errors
        { data: [], error: null }, // attachCategories
      ],
      scanResults: {
        data: [fixtureScanRow({ id: 'a-row', youtube_channel_id: 'UCa' })],
        error: null,
      },
    })
    const result = await fetchDiscoverFeed({ surface: 'all' })
    expect(result.error).toBeNull()
    expect(result.data.map((d) => d.id)).toEqual(['a-row'])
  })

  it('adds no catalog query when every allowed channel already has a scan row', async () => {
    const { cwChains } = setupMock({
      watchlist: { data: [fixtureWlRow({ youtube_channel_id: 'UCa' })], error: null },
      scanResults: { data: [fixtureScanRow({ id: 'a-row', youtube_channel_id: 'UCa' })], error: null },
    })
    const result = await fetchDiscoverFeed({ surface: 'all' })
    expect(result.data.map((d) => d.id)).toEqual(['a-row'])
    // cwChains: [0] gate, [1] attachCategories — no Segment 2 query (catalogIds empty).
    expect(cwChains).toHaveLength(2)
  })

  it('does not source catalog cards on the spiking-now surface', async () => {
    const { cwChains } = setupMock({
      watchlist: { data: [fixtureWlRow({ youtube_channel_id: 'UCa' })], error: null },
      scanResults: { data: [], error: null },
      momentum: { data: [], error: null },
    })
    await fetchDiscoverFeed({ surface: 'spiking-now' })
    // No Segment 2 catalog query: only the gate (and no attachCategories on empty).
    for (const c of cwChains) {
      expect(c.not.mock.calls).toHaveLength(0)
    }
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

describe('fetchDiscoverFeed — All tab inclusion freshness (PR 1 relax)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  // Helper: 'all' mode with a single channel + its scan row.
  function withSingleRow(scanRow: Record<string, unknown>) {
    setupMock({
      watchlist: { data: [{ youtube_channel_id: 'UCa' }], error: null },
      scanResults: { data: [scanRow], error: null },
    })
  }

  // Default (NEXT_PUBLIC_ALL_TAB_FRESHNESS_GATE unset = off → relaxed): the All
  // tab is a faceless opportunity CATALOG, so it surfaces every faceless scan
  // row regardless of scanned_at age. Stale rows are NOT dropped here (only the
  // Spiking Now surface enforces freshness).
  it('keeps a stale shorts row by default (relaxed — no inclusion freshness gate on All)', async () => {
    withSingleRow(
      fixtureScanRow({
        id: 'stale-short',
        youtube_channel_id: 'UCa',
        content_type: 'shorts',
        scanned_at: hoursAgoIso(72), // ~3d > 48h shorts window — kept now
      }),
    )
    const result = await fetchDiscoverFeed({ mode: 'all' })
    expect(result.error).toBeNull()
    expect(result.data.map((d) => d.id)).toEqual(['stale-short'])
  })

  it('keeps a stale longform row by default (relaxed)', async () => {
    withSingleRow(
      fixtureScanRow({
        id: 'stale-long',
        youtube_channel_id: 'UCa',
        content_type: 'longform',
        scanned_at: hoursAgoIso(120), // ~5d > 96h longform window — kept now
      }),
    )
    const result = await fetchDiscoverFeed({ mode: 'all' })
    expect(result.data.map((d) => d.id)).toEqual(['stale-long'])
  })

  it('does NOT over-fetch on the All path when relaxed (DB limit == requested limit)', async () => {
    const { scanChains } = setupMock({
      watchlist: { data: [{ youtube_channel_id: 'UCa' }], error: null },
      scanResults: {
        data: [
          fixtureScanRow({
            id: 'a',
            youtube_channel_id: 'UCa',
            content_type: 'shorts',
            scanned_at: hoursAgoIso(10),
          }),
        ],
        error: null,
      },
    })
    await fetchDiscoverFeed({ mode: 'all', limit: 10 })
    // Relaxed → no freshness refine → no 3x over-fetch.
    expect(scanChains[0].limit.mock.calls).toContainEqual([10])
  })

  // Opt-in strict gate: NEXT_PUBLIC_ALL_TAB_FRESHNESS_GATE=on restores the
  // legacy 96h/48h inclusion gate on the All tab (rollback path).
  describe('with NEXT_PUBLIC_ALL_TAB_FRESHNESS_GATE=on (strict, rollback)', () => {
    let prev: string | undefined
    beforeEach(() => {
      prev = process.env.NEXT_PUBLIC_ALL_TAB_FRESHNESS_GATE
      process.env.NEXT_PUBLIC_ALL_TAB_FRESHNESS_GATE = 'on'
    })
    afterEach(() => {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_ALL_TAB_FRESHNESS_GATE
      else process.env.NEXT_PUBLIC_ALL_TAB_FRESHNESS_GATE = prev
    })

    it('rejects a stale shorts row (scanned_at older than 48h)', async () => {
      withSingleRow(
        fixtureScanRow({
          id: 'stale-short',
          youtube_channel_id: 'UCa',
          content_type: 'shorts',
          scanned_at: hoursAgoIso(72),
        }),
      )
      const result = await fetchDiscoverFeed({ mode: 'all' })
      expect(result.error).toBeNull()
      expect(result.data).toEqual([])
    })

    it('keeps a fresh shorts row (scanned_at 30h, within 48h)', async () => {
      withSingleRow(
        fixtureScanRow({
          id: 'fresh-short',
          youtube_channel_id: 'UCa',
          content_type: 'shorts',
          scanned_at: hoursAgoIso(30),
        }),
      )
      const result = await fetchDiscoverFeed({ mode: 'all' })
      expect(result.data.map((d) => d.id)).toEqual(['fresh-short'])
    })

    it('rejects a longform row older than 96h', async () => {
      withSingleRow(
        fixtureScanRow({
          id: 'stale-long',
          youtube_channel_id: 'UCa',
          content_type: 'longform',
          scanned_at: hoursAgoIso(120),
        }),
      )
      const result = await fetchDiscoverFeed({ mode: 'all' })
      expect(result.data).toEqual([])
    })

    it('over-fetches (3x) on the all path so refined-out stale rows do not crowd out fresh ones', async () => {
      const { scanChains } = setupMock({
        watchlist: { data: [{ youtube_channel_id: 'UCa' }], error: null },
        scanResults: {
          data: [
            fixtureScanRow({
              id: 'a',
              youtube_channel_id: 'UCa',
              content_type: 'shorts',
              scanned_at: hoursAgoIso(10),
            }),
          ],
          error: null,
        },
      })
      await fetchDiscoverFeed({ mode: 'all', limit: 10 })
      expect(scanChains[0].limit.mock.calls).toContainEqual([30])
    })
  })
})

describe('fetchDiscoverFeed — Part B spiking-now (momentum)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('surfaces a channel whose momentum row is eligible and above floor', async () => {
    setupMock({
      watchlist: { data: [{ youtube_channel_id: 'UCa' }], error: null },
      scanResults: {
        data: [fixtureScanRow({ id: 'a', youtube_channel_id: 'UCa' })],
        error: null,
      },
      momentum: {
        data: [fixtureMomentumRow({ youtube_channel_id: 'UCa', current_eligible: true, trend_score: 80 })],
        error: null,
      },
    })
    const result = await fetchDiscoverFeed({ surface: 'spiking-now' })
    expect(result.error).toBeNull()
    expect(result.data.map((d) => d.id)).toEqual(['a'])
    expect(result.data[0].spikingNow).toBe(true)
  })

  it('excludes a channel with NO momentum row (missing row → not spiking, no legacy fallback)', async () => {
    setupMock({
      watchlist: { data: [{ youtube_channel_id: 'UCa' }], error: null },
      scanResults: {
        // A row legacy isSpikingNow WOULD fire on (longform outlier_ratio 9).
        data: [fixtureScanRow({ id: 'a', youtube_channel_id: 'UCa', outlier_ratio: 9 })],
        error: null,
      },
      momentum: { data: [], error: null },
    })
    const result = await fetchDiscoverFeed({ surface: 'spiking-now' })
    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  it('excludes a channel whose momentum row is current_eligible=false', async () => {
    setupMock({
      watchlist: { data: [{ youtube_channel_id: 'UCa' }], error: null },
      scanResults: {
        data: [fixtureScanRow({ id: 'a', youtube_channel_id: 'UCa', outlier_ratio: 9 })],
        error: null,
      },
      momentum: {
        data: [fixtureMomentumRow({ youtube_channel_id: 'UCa', current_eligible: false, trend_score: 100 })],
        error: null,
      },
    })
    const result = await fetchDiscoverFeed({ surface: 'spiking-now' })
    expect(result.data).toEqual([])
  })

  it('excludes a channel whose trend_score is below MOMENTUM_TREND_FLOOR (70)', async () => {
    setupMock({
      watchlist: { data: [{ youtube_channel_id: 'UCa' }], error: null },
      scanResults: {
        data: [fixtureScanRow({ id: 'a', youtube_channel_id: 'UCa' })],
        error: null,
      },
      momentum: {
        data: [fixtureMomentumRow({ youtube_channel_id: 'UCa', current_eligible: true, trend_score: 69 })],
        error: null,
      },
    })
    const result = await fetchDiscoverFeed({ surface: 'spiking-now' })
    expect(result.data).toEqual([])
  })

  it('sorts by momentumTrendScore desc, then momentumViewsPerHour desc', async () => {
    setupMock({
      watchlist: {
        data: [
          { youtube_channel_id: 'UCa' },
          { youtube_channel_id: 'UCb' },
          { youtube_channel_id: 'UCc' },
        ],
        error: null,
      },
      scanResults: {
        data: [
          fixtureScanRow({ id: 'a', youtube_channel_id: 'UCa' }),
          fixtureScanRow({ id: 'b', youtube_channel_id: 'UCb' }),
          fixtureScanRow({ id: 'c', youtube_channel_id: 'UCc' }),
        ],
        error: null,
      },
      momentum: {
        data: [
          // UCa & UCc tie on trend (75) → views/hour breaks it: UCc (300) > UCa (100).
          fixtureMomentumRow({ youtube_channel_id: 'UCa', trend_score: 75, views_per_hour: 100 }),
          fixtureMomentumRow({ youtube_channel_id: 'UCb', trend_score: 90, views_per_hour: 50 }),
          fixtureMomentumRow({ youtube_channel_id: 'UCc', trend_score: 75, views_per_hour: 300 }),
        ],
        error: null,
      },
    })
    const result = await fetchDiscoverFeed({ surface: 'spiking-now' })
    expect(result.data.map((d) => d.id)).toEqual(['b', 'c', 'a'])
  })

  it('flag off (NEXT_PUBLIC_SPIKE_MOMENTUM_MODE=off) uses legacy isSpikingNow and never queries the view', async () => {
    const prev = process.env.NEXT_PUBLIC_SPIKE_MOMENTUM_MODE
    process.env.NEXT_PUBLIC_SPIKE_MOMENTUM_MODE = 'off'
    try {
      const { momChains } = setupMock({
        watchlist: { data: [{ youtube_channel_id: 'UCa' }], error: null },
        scanResults: {
          // Longform outlier_ratio 5 → legacy isSpikingNow fires; NO momentum row.
          data: [fixtureScanRow({ id: 'a', youtube_channel_id: 'UCa', outlier_ratio: 5 })],
          error: null,
        },
        momentum: { data: [], error: null },
      })
      const result = await fetchDiscoverFeed({ surface: 'spiking-now' })
      expect(result.data.map((d) => d.id)).toEqual(['a'])
      // Revert mode must not consult the momentum view at all.
      expect(momChains.length).toBe(0)
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SPIKE_MOMENTUM_MODE
      else process.env.NEXT_PUBLIC_SPIKE_MOMENTUM_MODE = prev
    }
  })
})

describe('fetchDiscoverFeed — Part B all tab (no momentum view query)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('keeps cards in opportunityScore order and does NOT query channel_current_momentum', async () => {
    // Hotfix: the All tab must not consult the momentum view (it aggregates
    // video_snapshots per request and slowed initial load). Even though the
    // view would mark UCa spiking, the All tab keeps pure opportunity_score
    // order and never queries it.
    const { momChains } = setupMock({
      watchlist: {
        data: [{ youtube_channel_id: 'UCb' }, { youtube_channel_id: 'UCa' }],
        error: null,
      },
      scanResults: {
        // UCb (opp 90) first, UCa (opp 30) second — SQL opportunity_score order.
        data: [
          fixtureScanRow({ id: 'b', youtube_channel_id: 'UCb', opportunity_score: 90 }),
          fixtureScanRow({ id: 'a', youtube_channel_id: 'UCa', opportunity_score: 30 }),
        ],
        error: null,
      },
      momentum: {
        data: [fixtureMomentumRow({ youtube_channel_id: 'UCa', current_eligible: true, trend_score: 80 })],
        error: null,
      },
    })
    const result = await fetchDiscoverFeed({ surface: 'all' })
    // Pure opportunity_score order — UCa is NOT pinned above UCb.
    expect(result.data.map((d) => d.id)).toEqual(['b', 'a'])
    // The momentum view was never queried on the All tab.
    expect(momChains.length).toBe(0)
  })

  it('sets spikingNow=false (explicit, not undefined) on every All-tab card in momentum mode', async () => {
    setupMock({
      watchlist: { data: [{ youtube_channel_id: 'UCa' }], error: null },
      scanResults: {
        data: [fixtureScanRow({ id: 'a', youtube_channel_id: 'UCa', opportunity_score: 50 })],
        error: null,
      },
    })
    const result = await fetchDiscoverFeed({ surface: 'all' })
    expect(result.data.length).toBe(1)
    // Explicit false so NicheCard does not fall back to legacy isSpikingNow.
    expect(result.data[0].spikingNow).toBe(false)
  })
})

describe('fetchDiscoverFeed — Just Added (no momentum view query)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('does NOT query channel_current_momentum and sets spikingNow=false in momentum mode', async () => {
    const { momChains } = setupMock({
      watchlist: {
        data: [{ youtube_channel_id: 'UCa', tier_entered_at: hoursAgoIso(24) }],
        error: null,
      },
      scanResults: {
        data: [fixtureScanRow({ id: 'a', youtube_channel_id: 'UCa', opportunity_score: 50 })],
        error: null,
      },
      momentum: {
        data: [fixtureMomentumRow({ youtube_channel_id: 'UCa', current_eligible: true, trend_score: 80 })],
        error: null,
      },
    })
    const result = await fetchDiscoverFeed({ surface: 'just-added' })
    expect(result.data.map((d) => d.id)).toEqual(['a'])
    expect(result.data[0].spikingNow).toBe(false)
    expect(momChains.length).toBe(0)
  })
})

describe('fetchDiscoverFeed — momentum flag OFF (legacy badge fallback path)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('All tab leaves spikingNow undefined and does not query the momentum view when flag is off', async () => {
    const prev = process.env.NEXT_PUBLIC_SPIKE_MOMENTUM_MODE
    process.env.NEXT_PUBLIC_SPIKE_MOMENTUM_MODE = 'off'
    try {
      const { momChains } = setupMock({
        watchlist: { data: [{ youtube_channel_id: 'UCa' }], error: null },
        scanResults: {
          data: [fixtureScanRow({ id: 'a', youtube_channel_id: 'UCa', opportunity_score: 50 })],
          error: null,
        },
      })
      const result = await fetchDiscoverFeed({ surface: 'all' })
      expect(result.data.length).toBe(1)
      // Flag off: spikingNow unset → undefined → NicheCard uses legacy isSpikingNow.
      expect(result.data[0].spikingNow).toBeUndefined()
      expect(momChains.length).toBe(0)
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SPIKE_MOMENTUM_MODE
      else process.env.NEXT_PUBLIC_SPIKE_MOMENTUM_MODE = prev
    }
  })

  it('Just Added leaves spikingNow undefined and does not query the momentum view when flag is off', async () => {
    const prev = process.env.NEXT_PUBLIC_SPIKE_MOMENTUM_MODE
    process.env.NEXT_PUBLIC_SPIKE_MOMENTUM_MODE = 'off'
    try {
      const { momChains } = setupMock({
        watchlist: {
          data: [{ youtube_channel_id: 'UCa', tier_entered_at: hoursAgoIso(24) }],
          error: null,
        },
        scanResults: {
          data: [fixtureScanRow({ id: 'a', youtube_channel_id: 'UCa', opportunity_score: 50 })],
          error: null,
        },
      })
      const result = await fetchDiscoverFeed({ surface: 'just-added' })
      expect(result.data.length).toBe(1)
      expect(result.data[0].spikingNow).toBeUndefined()
      expect(momChains.length).toBe(0)
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SPIKE_MOMENTUM_MODE
      else process.env.NEXT_PUBLIC_SPIKE_MOMENTUM_MODE = prev
    }
  })
})

describe('fetchDiscoverFeed — Part B.3.1 spiking-now (view-first momentum path)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('returns a channel whose scan_results_latest.scanned_at is stale if the momentum view marks it eligible', async () => {
    // The root bug: scan_results.scanned_at was stale (>96h) so the old
    // attachMomentum-based path dropped it via the Part A freshness gate.
    // The view-first path skips the freshness gate — the view already proves
    // freshness via video_snapshots (last_metric_age_hours ≤ 26 in current_eligible).
    setupMock({
      watchlist: { data: [{ youtube_channel_id: 'UCa' }], error: null },
      scanResults: {
        data: [
          fixtureScanRow({
            id: 'stale-but-momentum',
            youtube_channel_id: 'UCa',
            scanned_at: hoursAgoIso(168), // 7 days — well beyond the 96h Part A gate
          }),
        ],
        error: null,
      },
      momentum: {
        data: [fixtureMomentumRow({ youtube_channel_id: 'UCa', current_eligible: true, trend_score: 80 })],
        error: null,
      },
    })
    const result = await fetchDiscoverFeed({ surface: 'spiking-now' })
    expect(result.error).toBeNull()
    expect(result.data.map((d) => d.id)).toEqual(['stale-but-momentum'])
    expect(result.data[0].spikingNow).toBe(true)
  })

  it('queries scan_results only for channels identified by the momentum view (view-first, not full scan pool)', async () => {
    // UCa and UCb are both in allowedIds and scan_results. Only UCb is in the
    // momentum view. The scan_results query must be driven by momentum candidates
    // — the .in() call must contain UCb but not UCa.
    const { scanChains } = setupMock({
      watchlist: {
        data: [{ youtube_channel_id: 'UCa' }, { youtube_channel_id: 'UCb' }],
        error: null,
      },
      scanResults: {
        data: [fixtureScanRow({ id: 'b', youtube_channel_id: 'UCb' })],
        error: null,
      },
      momentum: {
        data: [fixtureMomentumRow({ youtube_channel_id: 'UCb', current_eligible: true, trend_score: 80 })],
        error: null,
      },
    })
    const result = await fetchDiscoverFeed({ surface: 'spiking-now' })
    expect(result.data.map((d) => d.id)).toEqual(['b'])
    // scan_results_latest .in() must list only the momentum candidate (UCb), not UCa.
    const inArgs = scanChains[0]?.in.mock.calls.find((c) => c[0] === 'youtube_channel_id')
    expect(inArgs?.[1]).toContain('UCb')
    expect(inArgs?.[1]).not.toContain('UCa')
  })

  it('excludes a channel that is in the momentum view but not in channels_watchlist allowedIds', async () => {
    // UCb is spiking in the view but is NOT in allowedIds (face channel or evicted).
    // The JS intersection must block it even though the DB view returned it.
    setupMock({
      watchlist: { data: [{ youtube_channel_id: 'UCa' }], error: null },
      scanResults: {
        data: [fixtureScanRow({ id: 'b', youtube_channel_id: 'UCb' })],
        error: null,
      },
      momentum: {
        data: [fixtureMomentumRow({ youtube_channel_id: 'UCb', current_eligible: true, trend_score: 80 })],
        error: null,
      },
    })
    const result = await fetchDiscoverFeed({ surface: 'spiking-now' })
    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  it('excludes a spiking channel that has no scan_results_latest row (cannot render a card)', async () => {
    setupMock({
      watchlist: { data: [{ youtube_channel_id: 'UCa' }], error: null },
      scanResults: { data: [], error: null },
      momentum: {
        data: [fixtureMomentumRow({ youtube_channel_id: 'UCa', current_eligible: true, trend_score: 80 })],
        error: null,
      },
    })
    const result = await fetchDiscoverFeed({ surface: 'spiking-now' })
    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  it('flag off (NEXT_PUBLIC_SPIKE_MOMENTUM_MODE=off) does not use the view-first path and applies the Part A freshness gate', async () => {
    // Contrast with test 1: with flag off, a stale scan_results row IS rejected
    // by the Part A gate even if legacy isSpikingNow would fire. The view-first
    // path must not activate.
    const prev = process.env.NEXT_PUBLIC_SPIKE_MOMENTUM_MODE
    process.env.NEXT_PUBLIC_SPIKE_MOMENTUM_MODE = 'off'
    try {
      const { momChains } = setupMock({
        watchlist: { data: [{ youtube_channel_id: 'UCa' }], error: null },
        scanResults: {
          data: [
            fixtureScanRow({
              id: 'a',
              youtube_channel_id: 'UCa',
              outlier_ratio: 5,
              scanned_at: hoursAgoIso(168), // 7d stale — Part A rejects this
            }),
          ],
          error: null,
        },
        momentum: {
          data: [fixtureMomentumRow({ youtube_channel_id: 'UCa', current_eligible: true, trend_score: 80 })],
          error: null,
        },
      })
      const result = await fetchDiscoverFeed({ surface: 'spiking-now' })
      // Legacy path: Part A freshness gate drops the stale row → empty tab.
      expect(result.data).toEqual([])
      // view-first path must not be invoked.
      expect(momChains.length).toBe(0)
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SPIKE_MOMENTUM_MODE
      else process.env.NEXT_PUBLIC_SPIKE_MOMENTUM_MODE = prev
    }
  })
})
