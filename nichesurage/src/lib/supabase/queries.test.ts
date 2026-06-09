import {
  toSubscriberRange,
  mapRow,
  mapWatchlistRow,
  fetchRelatedNiches,
  fetchNicheById,
  fetchTrendingClusters,
  fetchNiches,
} from './queries'
import type { WatchlistCatalogRow } from './queries'
import type { DbScanResult } from '@/lib/types/database'
import type { NicheCardData, SearchFilters } from '@/lib/types'
import { createClient } from './client'

jest.mock('./client')

describe('toSubscriberRange', () => {
  it.each<[number, string]>([
    [0,       '<1K'],
    [500,     '<1K'],
    [999,     '<1K'],
    [1000,    '1K–5K'],
    [4999,    '1K–5K'],
    [5000,    '5K–10K'],
    [9999,    '5K–10K'],
    [10000,   '10K–50K'],
    [49999,   '10K–50K'],
    [50000,   '50K–100K'],
    [99999,   '50K–100K'],
    [100000,  '100K–500K'],
    [499999,  '100K–500K'],
    [500000,  '500K+'],
    [1000000, '500K+'],
  ])('count %i → %s', (count, expected) => {
    expect(toSubscriberRange(count)).toBe(expected)
  })
})

const baseRow: DbScanResult = {
  id: 'abc',
  youtube_channel_id: 'yt1',
  channel_name: 'Test Channel',
  niche_label: 'Finance',
  channel_url: 'https://youtube.com/c/test',
  channel_created_at: '2023-01-01',
  video_count: 50,
  subscriber_count: 7500,
  views_48h: 10000,
  views_avg: 5000,
  spike_multiplier: 4.2,
  engagement_rate: 5.1,
  opportunity_score: 80,
  virality_rating: 'excellent',
  language: 'en',
  content_type: 'shorts',
  hook_score: null,
  avg_view_duration_pct: null,
  search_volume: null,
  competition_score: null,
  scanned_at: '2026-04-28T10:00:00Z',
  outlier_ratio: null,
  is_spike: false,
  outlier_video_id: null,
  outlier_video_title: null,
  outlier_video_views: null,
  window_hours: 48,
  seed_keyword: null,
  cluster_id: null,
}

describe('mapRow', () => {
  it('maps a shorts row to ShortsNicheCardData', () => {
    const row = { ...baseRow, content_type: 'shorts' as const, hook_score: 88, avg_view_duration_pct: 72 }
    const result = mapRow(row)
    expect(result.contentType).toBe('shorts')
    expect(result.subscriberRange).toBe('5K–10K')
    expect(result.id).toBe('abc')
    expect(result.channelName).toBe('Test Channel')
    if (result.contentType === 'shorts') {
      expect(result.hookScore).toBe(88)
      expect(result.avgViewDurationPct).toBe(72)
    }
  })

  it('maps a longform row to LongformNicheCardData', () => {
    const row = { ...baseRow, content_type: 'longform' as const, search_volume: 40000, competition_score: 25 }
    const result = mapRow(row)
    expect(result.contentType).toBe('longform')
    expect(result.subscriberRange).toBe('5K–10K')
    if (result.contentType === 'longform') {
      expect(result.searchVolume).toBe(40000)
      expect(result.competitionScore).toBe(25)
      expect(result.avgViewsPerVideo).toBe(5000)
    }
  })

  it('maps null type-specific fields to undefined', () => {
    const row = { ...baseRow, content_type: 'shorts' as const }
    const result = mapRow(row)
    if (result.contentType === 'shorts') {
      expect(result.hookScore).toBeUndefined()
      expect(result.avgViewDurationPct).toBeUndefined()
    }
  })
})

// ─── internal-route faceless gate (PR 1) ──────────────────────────────────
// Every internal read path must intersect scan_results_latest with the
// faceless+active+not-evicted allow-list from getAllowedChannelIds(), so a
// channel can't surface here while being absent from the gated "All" feed.

type Resolved = { data: unknown; error: unknown }

interface QChain {
  select: jest.Mock
  eq: jest.Mock
  neq: jest.Mock
  gte: jest.Mock
  lte: jest.Mock
  is: jest.Mock
  not: jest.Mock
  in: jest.Mock
  order: jest.Mock
  limit: jest.Mock
  maybeSingle: jest.Mock
  then: (cb: (r: Resolved) => unknown) => Promise<unknown>
}

// Enforce any recorded .in('youtube_channel_id', ids) so the mock reflects the
// server-side gate: rows whose channel is not in the allow-list are dropped from
// the result (rows whose projection omits the column are kept untouched).
function filterByIn(data: unknown, inFilters: Array<[string, unknown[]]>): unknown {
  if (!Array.isArray(data)) return data
  let rows = data as Array<Record<string, unknown>>
  for (const [col, ids] of inFilters) {
    if (col !== 'youtube_channel_id') continue
    const set = new Set(ids)
    rows = rows.filter((r) => !(col in r) || set.has(r[col]))
  }
  return rows
}

function qChain(resolved: Resolved): QChain {
  const inFilters: Array<[string, unknown[]]> = []
  const chain: Partial<QChain> = {}
  const ret = () => chain as QChain
  chain.select = jest.fn(ret)
  chain.eq = jest.fn(ret)
  chain.neq = jest.fn(ret)
  chain.gte = jest.fn(ret)
  chain.lte = jest.fn(ret)
  chain.is = jest.fn(ret)
  chain.not = jest.fn(ret)
  chain.in = jest.fn((col: string, ids: unknown[]) => {
    inFilters.push([col, ids])
    return chain as QChain
  })
  chain.order = jest.fn(ret)
  chain.limit = jest.fn(ret)
  const resolve = () => ({ data: filterByIn(resolved.data, inFilters), error: resolved.error })
  chain.maybeSingle = jest.fn(() => {
    const r = resolve()
    return Promise.resolve({
      data: Array.isArray(r.data) ? ((r.data as unknown[])[0] ?? null) : r.data,
      error: r.error,
    })
  })
  chain.then = (onFulfilled) => Promise.resolve(resolve()).then(onFulfilled)
  return chain as QChain
}

interface QMockSetup {
  watchlist?: Resolved // shared by the gate query AND attachCategories
  scanResults?: Resolved
  videoMetrics?: Resolved
  nicheClusters?: Resolved
}

function setupQueriesMock(setup: QMockSetup) {
  const cw: QChain[] = []
  const scan: QChain[] = []
  const vm: QChain[] = []
  const nc: QChain[] = []
  ;(createClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === 'channels_watchlist') {
        const c = qChain(setup.watchlist ?? { data: [], error: null })
        cw.push(c)
        return c
      }
      if (table === 'scan_results_latest') {
        const c = qChain(setup.scanResults ?? { data: [], error: null })
        scan.push(c)
        return c
      }
      if (table === 'video_metrics') {
        const c = qChain(setup.videoMetrics ?? { data: [], error: null })
        vm.push(c)
        return c
      }
      if (table === 'niche_clusters') {
        const c = qChain(setup.nicheClusters ?? { data: [], error: null })
        nc.push(c)
        return c
      }
      return qChain({ data: [], error: null })
    }),
  })
  return { cw, scan, vm, nc }
}

const allowedRow = { youtube_channel_id: 'UCok', category: 'finance' }
const scanRowOk = { ...baseRow, id: 'sr-ok', youtube_channel_id: 'UCok', content_type: 'longform' as const }
const sourceNiche: NicheCardData = mapRow({
  ...baseRow,
  id: 'src',
  youtube_channel_id: 'UCsrc',
  content_type: 'longform',
  cluster_id: null,
})
const searchFilters: SearchFilters = {
  contentType: 'longform',
  subscriberMin: 0,
  subscriberMax: 1_000_000,
  channelAge: 'any',
  onlyRecentlyViral: false,
  sortBy: 'score',
}

describe('fetchRelatedNiches — faceless gate', () => {
  beforeEach(() => jest.resetAllMocks())

  it('returns [] when the gate resolves empty (no faceless channels)', async () => {
    setupQueriesMock({
      watchlist: { data: [], error: null },
      scanResults: { data: [scanRowOk], error: null },
    })
    expect(await fetchRelatedNiches(sourceNiche)).toEqual([])
  })

  it('intersects the scan_results_latest query with the allowed ids', async () => {
    const { scan } = setupQueriesMock({
      watchlist: { data: [allowedRow], error: null },
      scanResults: { data: [scanRowOk], error: null },
    })
    const result = await fetchRelatedNiches(sourceNiche)
    expect(result).toHaveLength(1)
    expect(scan[0].in.mock.calls).toContainEqual(['youtube_channel_id', ['UCok']])
  })
})

describe('fetchNicheById — faceless gate', () => {
  beforeEach(() => jest.resetAllMocks())

  it('returns null when the gate resolves empty', async () => {
    setupQueriesMock({
      watchlist: { data: [], error: null },
      scanResults: { data: [scanRowOk], error: null },
    })
    expect(await fetchNicheById('sr-ok')).toBeNull()
  })

  it('gates the by-id lookup with the allowed ids', async () => {
    const { scan } = setupQueriesMock({
      watchlist: { data: [allowedRow], error: null },
      scanResults: { data: [scanRowOk], error: null },
    })
    const result = await fetchNicheById('sr-ok')
    expect(result?.id).toBe('sr-ok')
    expect(scan[0].in.mock.calls).toContainEqual(['youtube_channel_id', ['UCok']])
  })
})

describe('fetchNiches (search/Sonar) — faceless gate', () => {
  beforeEach(() => jest.resetAllMocks())

  it('returns [] when the gate resolves empty', async () => {
    setupQueriesMock({
      watchlist: { data: [], error: null },
      scanResults: { data: [scanRowOk], error: null },
    })
    const res = await fetchNiches(searchFilters, {})
    expect(res.data).toEqual([])
  })

  it('gates the scan query with the allowed ids', async () => {
    const { scan } = setupQueriesMock({
      watchlist: { data: [allowedRow], error: null },
      scanResults: { data: [scanRowOk], error: null },
    })
    const res = await fetchNiches(searchFilters, {})
    expect(res.data).toHaveLength(1)
    expect(scan[0].in.mock.calls).toContainEqual(['youtube_channel_id', ['UCok']])
  })
})

describe('fetchNiches mode=hot — faceless gate (JS intersect)', () => {
  beforeEach(() => jest.resetAllMocks())

  it('excludes a trend-ranked channel that is not in the faceless allow-list', async () => {
    const { scan } = setupQueriesMock({
      watchlist: { data: [allowedRow], error: null }, // only UCok allowed
      videoMetrics: {
        data: [
          { channel_id: 'UCok', trend_score: 80, lifecycle_status: 'exploding' },
          { channel_id: 'UCbad', trend_score: 90, lifecycle_status: 'exploding' },
        ],
        error: null,
      },
      scanResults: { data: [scanRowOk], error: null },
    })
    const res = await fetchNiches(searchFilters, { mode: 'hot' })
    expect(res.error).toBeNull()
    // Only the allowed channel reaches the scan query — UCbad is dropped.
    expect(scan[0].in.mock.calls).toContainEqual(['youtube_channel_id', ['UCok']])
  })

  it('excludes a non-allowed channel from the OUTPUT, not only from the query (C5)', async () => {
    const { scan } = setupQueriesMock({
      watchlist: { data: [allowedRow], error: null }, // only UCok is faceless-allowed
      videoMetrics: {
        data: [
          // UCbad outranks UCok by trend_score but is NOT faceless-allowed.
          { channel_id: 'UCbad', trend_score: 99, lifecycle_status: 'exploding' },
          { channel_id: 'UCok', trend_score: 80, lifecycle_status: 'exploding' },
        ],
        error: null,
      },
      // Even if the DB layer surfaced both rows, the gate must drop UCbad.
      scanResults: {
        data: [
          { ...baseRow, id: 'sr-ok', youtube_channel_id: 'UCok', content_type: 'longform' },
          { ...baseRow, id: 'sr-bad', youtube_channel_id: 'UCbad', content_type: 'longform' },
        ],
        error: null,
      },
    })

    const res = await fetchNiches(searchFilters, { mode: 'hot' })
    const channelIds = res.data.map((d) => d.youtubeChannelId)

    expect(channelIds).toContain('UCok')
    expect(channelIds).not.toContain('UCbad')
    // UCbad is gated out in the loop, so it never reaches the scan query either.
    expect(scan[0].in.mock.calls).toContainEqual(['youtube_channel_id', ['UCok']])
  })
})

describe('fetchTrendingClusters — faceless gate', () => {
  beforeEach(() => jest.resetAllMocks())

  it('returns [] when the gate resolves empty', async () => {
    setupQueriesMock({ watchlist: { data: [], error: null } })
    expect(await fetchTrendingClusters('longform')).toEqual([])
  })

  it('gates the cluster-member count query with the allowed ids', async () => {
    const { scan } = setupQueriesMock({
      watchlist: { data: [allowedRow], error: null },
      scanResults: { data: [{ cluster_id: 'cl1' }], error: null },
      nicheClusters: {
        data: [{ id: 'cl1', label: 'AI Agents', language: 'en', content_type: 'longform' }],
        error: null,
      },
    })
    const result = await fetchTrendingClusters('longform')
    expect(result.map((c) => c.id)).toEqual(['cl1'])
    expect(scan[0].in.mock.calls).toContainEqual(['youtube_channel_id', ['UCok']])
  })
})

// ─── PR 4: catalog-only cards (channels_watchlist backbone) ───────────────

describe('toSubscriberRange — null/invalid guard (PR 4)', () => {
  it('returns "Unknown" for null / undefined / NaN, not a misleading band', () => {
    expect(toSubscriberRange(null)).toBe('Unknown')
    expect(toSubscriberRange(undefined)).toBe('Unknown')
    expect(toSubscriberRange(Number.NaN)).toBe('Unknown')
  })
})

const wlRow: WatchlistCatalogRow = {
  youtube_channel_id: 'UCcat',
  channel_name: 'Catalog Channel',
  niche_label: 'Faceless History',
  content_type: 'longform',
  language: 'en',
  category: 'history',
  subscriber_count: 42000,
  video_count: 120,
  last_upload_at: '2026-06-01T00:00:00Z',
  first_discovered_at: '2026-05-01T00:00:00Z',
}

describe('mapWatchlistRow (PR 4)', () => {
  it('builds an honest catalog card with a synthetic wl: id', () => {
    const card = mapWatchlistRow(wlRow)
    expect(card.id).toBe('wl:UCcat')
    expect(card.youtubeChannelId).toBe('UCcat')
    expect(card.catalogOnly).toBe(true)
    expect(card.spikingNow).toBe(false)
    expect(card.subscriberRange).toBe('10K–50K')
    expect(card.videoCount).toBe(120)
    expect(card.lastUploadAt).toBe('2026-06-01T00:00:00Z')
    expect(card.channelName).toBe('Catalog Channel')
    expect(card.category).toBe('history')
  })

  it('maps content_type to the right card variant', () => {
    expect(mapWatchlistRow(wlRow).contentType).toBe('longform')
    expect(mapWatchlistRow({ ...wlRow, content_type: 'shorts' }).contentType).toBe('shorts')
  })

  it('carries inert (never-rendered) placeholders for score-shaped fields', () => {
    const card = mapWatchlistRow(wlRow)
    expect(card.opportunityScore).toBe(0)
    expect(card.spikeMultiplier).toBe(0)
    expect(card.viralityRating).toBe('average')
  })

  it('tolerates null name/category/last_upload without producing fake values', () => {
    const card = mapWatchlistRow({
      ...wlRow,
      channel_name: null,
      niche_label: null,
      category: null,
      last_upload_at: null,
    })
    expect(card.channelName).toBeUndefined()
    expect(card.category).toBeUndefined()
    expect(card.lastUploadAt).toBeUndefined()
  })
})

describe('fetchNicheById — wl: catalog resolver (PR 4)', () => {
  beforeEach(() => jest.resetAllMocks())

  it('resolves a catalog detail through the faceless gate', async () => {
    setupQueriesMock({ watchlist: { data: [wlRow], error: null } })
    const card = await fetchNicheById('wl:UCcat')
    expect(card?.id).toBe('wl:UCcat')
    expect(card?.catalogOnly).toBe(true)
  })

  it('returns null (fail-closed) when the wl channel is not in the allow-list', async () => {
    setupQueriesMock({ watchlist: { data: [wlRow], error: null } }) // only UCcat allowed
    expect(await fetchNicheById('wl:UCnope')).toBeNull()
  })

  it('requires populated catalog fields via NOT NULL predicates', async () => {
    const { cw } = setupQueriesMock({ watchlist: { data: [wlRow], error: null } })
    await fetchNicheById('wl:UCcat')
    // cw[0] = gate (getAllowedChannelIds); cw[1] = catalog lookup.
    expect(cw[1].not.mock.calls).toContainEqual(['subscriber_count', 'is', null])
    expect(cw[1].not.mock.calls).toContainEqual(['video_count', 'is', null])
  })

  it('does not hit scan_results_latest for a wl: id', async () => {
    const { scan } = setupQueriesMock({ watchlist: { data: [wlRow], error: null } })
    await fetchNicheById('wl:UCcat')
    expect(scan).toHaveLength(0)
  })
})
