jest.mock('@/lib/supabase/staticClient', () => ({
  createStaticClient: jest.fn(),
}))

import { createStaticClient } from '@/lib/supabase/staticClient'
import { fetchTopNiches } from './fetchTopNiches'

const mockCreateStaticClient = createStaticClient as jest.MockedFunction<typeof createStaticClient>

// A safe public_landing_niches() row — only the non-identity columns the RPC
// (migration 0067) returns. Deliberately NO channel_name / channel_url /
// youtube_channel_id / niche_label.
const baseRow = {
  id: 'r1',
  channel_num: 421,
  opportunity_score: 88,
  virality_rating: 'excellent' as const,
  spike_multiplier: 6,
  engagement_rate: 4.2,
  views_48h: 10000,
  views_avg: 800,
  subscriber_count: 5000,
  video_count: 50,
  content_type: 'shorts' as const,
  language: 'en' as const,
  is_spike: true,
  outlier_ratio: 12.5,
  cluster_id: 'c1',
  scanned_at: new Date().toISOString(),
}

// Wire createStaticClient().rpc(...) -> chainable builder whose terminal
// .limit() resolves to { data, error }. fetchTopNiches calls
// .rpc(name).gte(...).order(...).limit(...).
function mockRpc(rows: unknown, error: unknown = null) {
  const builder = {
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: rows, error }),
  }
  mockCreateStaticClient.mockReturnValue({
    rpc: jest.fn().mockReturnValue(builder),
  } as unknown as ReturnType<typeof createStaticClient>)
}

describe('fetchTopNiches', () => {
  beforeEach(() => {
    mockRpc([baseRow])
  })

  it('masks the channel name with the server-computed channel_num', async () => {
    const niches = await fetchTopNiches()
    expect(niches[0].channelName).toBe('Hidden Channel #421')
  })

  it('never leaks identity fields', async () => {
    const niches = await fetchTopNiches()
    const n = niches[0] as unknown as Record<string, unknown>
    expect(n.channelUrl).toBeUndefined()
    expect(n.youtubeChannelId).toBe('')
    expect(n.channelCreatedAt).toBe('')
  })

  it('uses a coarse content-type label, not a real niche label', async () => {
    const shorts = await fetchTopNiches()
    expect(shorts[0].nicheLabel).toBe('Faceless Shorts')

    mockRpc([{ ...baseRow, content_type: 'longform' }])
    const longform = await fetchTopNiches()
    expect(longform[0].nicheLabel).toBe('Faceless Long-form')
  })

  it('sets trending=true when spikeMultiplier >= 5', async () => {
    const niches = await fetchTopNiches()
    expect(niches[0].trending).toBe(true)
  })

  it('sets trending=false when spikeMultiplier < 5', async () => {
    mockRpc([{ ...baseRow, spike_multiplier: 3 }])
    const niches = await fetchTopNiches()
    expect(niches[0].trending).toBe(false)
  })

  it('sets trending=true when spikeMultiplier === 5 (boundary)', async () => {
    mockRpc([{ ...baseRow, spike_multiplier: 5 }])
    const niches = await fetchTopNiches()
    expect(niches[0].trending).toBe(true)
  })

  it('maps avgViewsPerVideo from views_avg for longform', async () => {
    mockRpc([{ ...baseRow, content_type: 'longform' }])
    const niches = await fetchTopNiches()
    expect((niches[0] as { avgViewsPerVideo?: number }).avgViewsPerVideo).toBe(800)
  })

  it('returns empty array on Supabase error', async () => {
    mockRpc(null, { message: 'DB error' })
    const niches = await fetchTopNiches()
    expect(niches).toEqual([])
  })
})
