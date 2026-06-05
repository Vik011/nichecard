/** @jest-environment node */

jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: jest.fn(),
}))

jest.mock('@/lib/tier/freeDemo', () => ({
  ...jest.requireActual('@/lib/tier/freeDemo'),
  getDailyDemoNiche: jest.fn(),
}))

import { GET } from './route'
import { getDailyDemoNiche } from '@/lib/tier/freeDemo'
import { createServiceClient } from '@/lib/supabase/service'

const mockedGetDailyDemoNiche = getDailyDemoNiche as jest.MockedFunction<typeof getDailyDemoNiche>
const mockedCreateServiceClient = createServiceClient as jest.MockedFunction<typeof createServiceClient>

describe('GET /api/demo/today', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedCreateServiceClient.mockReturnValue({ from: jest.fn() } as never)
  })

  it('returns the scanResultId when pin exists or was just inserted', async () => {
    mockedGetDailyDemoNiche.mockResolvedValue({
      scanResultId: 'sr-123',
      youtubeChannelId: 'UC-xyz',
      justInserted: false,
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ scanResultId: 'sr-123' })
  })

  it('returns null scanResultId and no-store when getDailyDemoNiche resolves null', async () => {
    mockedGetDailyDemoNiche.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ scanResultId: null })
    // A null pin must NOT be cached at the edge — it would freeze the
    // all-locked state across Free accounts for the cache TTL.
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('returns no-store (no edge caching) when a pin resolves', async () => {
    mockedGetDailyDemoNiche.mockResolvedValue({
      scanResultId: 'sr-123',
      youtubeChannelId: 'UC-xyz',
      justInserted: false,
    })
    const res = await GET()
    const cc = res.headers.get('Cache-Control')
    expect(cc).toBe('no-store')
    // The pin is mutable (revalidated/replaced) — it must not be edge-cached.
    expect(cc).not.toMatch(/s-maxage/)
  })

  it('returns no-store when getDailyDemoNiche throws', async () => {
    mockedGetDailyDemoNiche.mockRejectedValue(new Error('db down'))
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ scanResultId: null })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})
