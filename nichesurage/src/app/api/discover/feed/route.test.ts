/** @jest-environment node */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(() => ({})) }))
jest.mock('@/lib/discover/serverContext', () => ({
  resolveSessionUser: jest.fn(),
  resolveTodayPinId: jest.fn(),
}))
jest.mock('@/lib/discover/fetchDiscoverFeed', () => ({ fetchDiscoverFeed: jest.fn() }))

import { GET } from './route'
import { resolveSessionUser, resolveTodayPinId } from '@/lib/discover/serverContext'
import { fetchDiscoverFeed } from '@/lib/discover/fetchDiscoverFeed'
import type { NicheCardData } from '@/lib/types'

const mockedSession = resolveSessionUser as jest.MockedFunction<typeof resolveSessionUser>
const mockedPin = resolveTodayPinId as jest.MockedFunction<typeof resolveTodayPinId>
const mockedFeed = fetchDiscoverFeed as jest.MockedFunction<typeof fetchDiscoverFeed>

function makeRow(over: Partial<NicheCardData> = {}): NicheCardData {
  return {
    id: 'sr-1',
    youtubeChannelId: 'UCreal1',
    contentType: 'shorts',
    channelCreatedAt: '2023-01-01',
    videoCount: 50,
    subscriberCount: 7500,
    subscriberRange: '5K–10K',
    spikeMultiplier: 4,
    opportunityScore: 80,
    viralityRating: 'excellent',
    language: 'en',
    channelName: 'RealChannel1',
    nicheLabel: 'Crypto',
    channelUrl: 'https://youtube.com/channel/UCreal1',
    ...over,
  } as NicheCardData
}

function req(qs = 'surface=all') {
  return new Request(`http://localhost/api/discover/feed?${qs}`)
}

describe('GET /api/discover/feed', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedPin.mockResolvedValue(null)
  })

  it('fails closed with 401 + no-store when there is no session', async () => {
    mockedSession.mockResolvedValue({ userId: null, tier: 'free' })
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(mockedFeed).not.toHaveBeenCalled()
  })

  it('Free: redacts all non-pin rows; pin stays full', async () => {
    mockedSession.mockResolvedValue({ userId: 'u1', tier: 'free' })
    mockedPin.mockResolvedValue('pin')
    mockedFeed.mockResolvedValue({
      data: [
        makeRow({ id: 'pin', youtubeChannelId: 'UCpin', channelName: 'PinChan' }),
        makeRow({ id: 'sr-2', youtubeChannelId: 'UClocked', channelName: 'LockedChan' }),
      ],
      error: null,
    })
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const body = await res.json()
    expect(body.revealedIds).toEqual(['pin'])
    expect(body.todayPinId).toBe('pin')
    const byId = Object.fromEntries(body.data.map((r: NicheCardData) => [r.id, r]))
    expect(byId['pin'].channelName).toBe('PinChan')
    expect(byId['sr-2'].youtubeChannelId).toBe('')
    expect(byId['sr-2'].channelName).toMatch(/^Hidden Channel #/)
    expect(JSON.stringify(body.data)).not.toContain('UClocked')
    expect(JSON.stringify(body.data)).not.toContain('LockedChan')
  })

  it('Premium: every row full', async () => {
    mockedSession.mockResolvedValue({ userId: 'u1', tier: 'premium' })
    mockedFeed.mockResolvedValue({
      data: [makeRow({ id: 'a', youtubeChannelId: 'UCa', channelName: 'A' })],
      error: null,
    })
    const res = await GET(req())
    const body = await res.json()
    expect(body.data[0].youtubeChannelId).toBe('UCa')
    expect(body.data[0].channelName).toBe('A')
  })

  it('ignores a client-supplied tier param (uses session tier)', async () => {
    mockedSession.mockResolvedValue({ userId: 'u1', tier: 'free' })
    mockedPin.mockResolvedValue(null)
    mockedFeed.mockResolvedValue({
      data: [makeRow({ id: 'x', youtubeChannelId: 'UCx', channelName: 'X' })],
      error: null,
    })
    const res = await GET(req('surface=all&tier=premium'))
    const body = await res.json()
    // free + no pin → redacted, despite ?tier=premium
    expect(body.data[0].youtubeChannelId).toBe('')
  })

  it('passes through a feed error without leaking', async () => {
    mockedSession.mockResolvedValue({ userId: 'u1', tier: 'free' })
    mockedFeed.mockResolvedValue({ data: [], error: 'Discover fetch failed' })
    const res = await GET(req())
    const body = await res.json()
    expect(body).toEqual({ data: [], revealedIds: [], todayPinId: null, error: 'Discover fetch failed' })
  })
})
