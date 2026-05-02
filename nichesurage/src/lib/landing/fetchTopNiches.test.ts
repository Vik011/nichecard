jest.mock('@/lib/supabase/staticClient', () => ({
  createStaticClient: jest.fn(),
}))

import { createStaticClient } from '@/lib/supabase/staticClient'
import { fetchTopNiches, deterministicChannelNum } from './fetchTopNiches'

const mockCreateStaticClient = createStaticClient as jest.MockedFunction<typeof createStaticClient>

describe('deterministicChannelNum', () => {
  it('returns a number in range 100–999', () => {
    const n = deterministicChannelNum('UCabc123')
    expect(Number(n)).toBeGreaterThanOrEqual(100)
    expect(Number(n)).toBeLessThanOrEqual(999)
  })

  it('is stable — same input always returns same output', () => {
    expect(deterministicChannelNum('UCabc123')).toBe(deterministicChannelNum('UCabc123'))
  })

  it('different channel IDs produce different numbers (very likely)', () => {
    expect(deterministicChannelNum('UCaaa')).not.toBe(deterministicChannelNum('UCbbb'))
  })
})

describe('fetchTopNiches', () => {
  const mockRows = [
    {
      id: 'r1',
      youtube_channel_id: 'UCabc',
      channel_name: 'Real Channel',
      channel_url: 'https://youtube.com/c/real',
      niche_label: 'AI tutorials',
      channel_created_at: '2024-01-01',
      video_count: 50,
      subscriber_count: 5000,
      views_48h: 10000,
      views_avg: 800,
      spike_multiplier: 6,
      engagement_rate: 4.2,
      opportunity_score: 88,
      virality_rating: 'excellent' as const,
      language: 'en' as const,
      content_type: 'shorts' as const,
      hook_score: 8,
      avg_view_duration_pct: 72,
      search_volume: null,
      competition_score: null,
      scanned_at: new Date().toISOString(),
    },
  ]

  beforeEach(() => {
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
    } as unknown
    ;(mockQuery as Record<string, jest.Mock>).limit = jest.fn().mockResolvedValue({
      data: mockRows,
      error: null,
    })
    mockCreateStaticClient.mockReturnValue({
      from: jest.fn().mockReturnValue(mockQuery),
    } as unknown as ReturnType<typeof createStaticClient>)
  })

  it('masks channel_name with deterministic label', async () => {
    const niches = await fetchTopNiches()
    expect(niches[0].channelName).toMatch(/^Hidden Channel #\d{3}$/)
  })

  it('strips channelUrl', async () => {
    const niches = await fetchTopNiches()
    expect(niches[0].channelUrl).toBeUndefined()
  })

  it('sets trending=true when spikeMultiplier >= 5', async () => {
    const niches = await fetchTopNiches()
    expect(niches[0].trending).toBe(true)
  })

  it('sets trending=false when spikeMultiplier < 5', async () => {
    const lowSpikeRows = [{ ...mockRows[0], spike_multiplier: 3 }]
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: lowSpikeRows, error: null }),
    }
    mockCreateStaticClient.mockReturnValue({
      from: jest.fn().mockReturnValue(mockQuery),
    } as unknown as ReturnType<typeof createStaticClient>)
    const niches = await fetchTopNiches()
    expect(niches[0].trending).toBe(false)
  })

  it('sets trending=true when spikeMultiplier === 5 (boundary)', async () => {
    const boundaryRows = [{ ...mockRows[0], spike_multiplier: 5 }]
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: boundaryRows, error: null }),
    }
    mockCreateStaticClient.mockReturnValue({
      from: jest.fn().mockReturnValue(mockQuery),
    } as unknown as ReturnType<typeof createStaticClient>)
    const niches = await fetchTopNiches()
    expect(niches[0].trending).toBe(true)
  })

  it('returns empty array on Supabase error', async () => {
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    }
    mockCreateStaticClient.mockReturnValue({
      from: jest.fn().mockReturnValue(mockQuery),
    } as unknown as ReturnType<typeof createStaticClient>)
    const niches = await fetchTopNiches()
    expect(niches).toEqual([])
  })
})
