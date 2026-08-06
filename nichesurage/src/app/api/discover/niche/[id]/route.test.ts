/** @jest-environment node */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(() => ({})) }))
jest.mock('@/lib/discover/serverContext', () => ({
  resolveSessionUser: jest.fn(),
  resolveTodayPinId: jest.fn(),
}))
jest.mock('@/lib/supabase/queries', () => ({ fetchNicheById: jest.fn() }))

import { GET } from './route'
import { resolveSessionUser, resolveTodayPinId } from '@/lib/discover/serverContext'
import { fetchNicheById } from '@/lib/supabase/queries'
import type { NicheCardData } from '@/lib/types'

const mockedSession = resolveSessionUser as jest.MockedFunction<typeof resolveSessionUser>
const mockedPin = resolveTodayPinId as jest.MockedFunction<typeof resolveTodayPinId>
const mockedById = fetchNicheById as jest.MockedFunction<typeof fetchNicheById>

function makeRow(id: string): NicheCardData {
  return {
    id,
    youtubeChannelId: 'UCdetail',
    contentType: 'shorts',
    channelCreatedAt: '2023-01-01',
    videoCount: 50,
    subscriberCount: 7500,
    subscriberRange: '5K–10K',
    spikeMultiplier: 4,
    opportunityScore: 80,
    viralityRating: 'excellent',
    language: 'en',
    channelName: 'DetailChan',
    nicheLabel: 'Crypto',
    channelUrl: 'https://youtube.com/channel/UCdetail',
  } as NicheCardData
}

const params = (id: string) => ({ params: { id } })
const req = new Request('http://localhost/api/discover/niche/x')

describe('GET /api/discover/niche/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedPin.mockResolvedValue('pin')
  })

  it('401 + no-store without a session', async () => {
    mockedSession.mockResolvedValue({ userId: null, tier: 'free' })
    const res = await GET(req, params('sr-1'))
    expect(res.status).toBe(401)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(mockedById).not.toHaveBeenCalled()
  })

  it('returns {data:null} when the niche is not found', async () => {
    mockedSession.mockResolvedValue({ userId: 'u1', tier: 'premium' })
    mockedById.mockResolvedValue(null)
    const res = await GET(req, params('missing'))
    const body = await res.json()
    expect(body).toEqual({ data: null, locked: false, error: null })
  })

  it('Premium → full identity', async () => {
    mockedSession.mockResolvedValue({ userId: 'u1', tier: 'premium' })
    mockedById.mockResolvedValue(makeRow('sr-1'))
    const body = await (await GET(req, params('sr-1'))).json()
    expect(body.locked).toBe(false)
    expect(body.data.youtubeChannelId).toBe('UCdetail')
    expect(body.data.channelName).toBe('DetailChan')
  })

  it('Free + id === pin → full identity', async () => {
    mockedSession.mockResolvedValue({ userId: 'u1', tier: 'free' })
    mockedPin.mockResolvedValue('pin')
    mockedById.mockResolvedValue(makeRow('pin'))
    const body = await (await GET(req, params('pin'))).json()
    expect(body.locked).toBe(false)
    expect(body.data.youtubeChannelId).toBe('UCdetail')
  })

  it('Free + id !== pin → redacted', async () => {
    mockedSession.mockResolvedValue({ userId: 'u1', tier: 'free' })
    mockedPin.mockResolvedValue('pin')
    mockedById.mockResolvedValue(makeRow('sr-other'))
    const body = await (await GET(req, params('sr-other'))).json()
    expect(body.locked).toBe(true)
    expect(body.data.youtubeChannelId).toBe('')
    expect(body.data.channelName).toMatch(/^Hidden Channel #/)
    expect(JSON.stringify(body.data)).not.toContain('UCdetail')
  })

  it('Basic → redacted by default (context-free detail)', async () => {
    mockedSession.mockResolvedValue({ userId: 'u1', tier: 'basic' })
    mockedById.mockResolvedValue(makeRow('sr-1'))
    const body = await (await GET(req, params('sr-1'))).json()
    expect(body.locked).toBe(true)
    expect(body.data.youtubeChannelId).toBe('')
    expect(JSON.stringify(body.data)).not.toContain('UCdetail')
  })
})
