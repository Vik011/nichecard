/**
 * @jest-environment node
 *
 * Tests for GET /api/content-angles/[id]
 *
 * The route has two main paths:
 *  1. Demo bypass: scan_id matches today's pinned daily_demo_niche AND
 *     ?demo=1 query param AND surgeniche_demo_seen cookie → serve cached result, no tier check.
 *  2. Tier check: FREE → 403, BASIC/PREMIUM run normal quota logic.
 */

// ─── Mocks ───────────────────────────────────────────────────────────────

// Supabase server client (user-scoped, RLS-respecting)
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

// Supabase service client (bypasses RLS — used by isTodaysDemoNiche, preWarmDemoNiche)
jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: jest.fn(),
}))

// AI quota helpers
jest.mock('@/lib/tier/aiUsage', () => ({
  checkAiQuota: jest.fn(),
  recordAiRun: jest.fn(),
}))

// Content angles generation (deterministic output for tests)
jest.mock('@/lib/content-angles/generate', () => ({
  generateAngles: jest.fn(async () => [
    { title: 'Angle 1', hook: 'Hook 1', why_it_works: 'Reason 1' },
  ]),
  AnglesParseError: class AnglesParseError extends Error {},
}))

// freeDemo utcDateKey — pin to a fixed date so tests are deterministic
jest.mock('@/lib/tier/freeDemo', () => ({
  utcDateKey: jest.fn(() => '2026-05-25'),
}))

// preWarmDemoNiche — tested separately; stub here
jest.mock('@/lib/demo/preWarm', () => ({
  preWarmDemoNiche: jest.fn(),
}))

// ─── Imports ─────────────────────────────────────────────────────────────

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkAiQuota } from '@/lib/tier/aiUsage'

const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockedCreateServiceClient = createServiceClient as jest.MockedFunction<typeof createServiceClient>
const mockedCheckAiQuota = checkAiQuota as jest.MockedFunction<typeof checkAiQuota>

// ─── Mock builders ───────────────────────────────────────────────────────

const CACHED_ANGLES = [
  { title: 'Demo Angle 1', hook: 'Demo Hook 1', why_it_works: 'Demo Reason 1' },
  { title: 'Demo Angle 2', hook: 'Demo Hook 2', why_it_works: 'Demo Reason 2' },
]

/**
 * Build a minimal Supabase user-scoped client mock.
 * `tier` sets what the `users` table returns.
 * `anglesCacheRow` is what `content_angles_cache` returns (or null = no cache).
 */
function makeUserClient(opts: {
  userId?: string
  tier?: 'free' | 'basic' | 'premium'
  anglesCacheRow?: { angles: object[]; expires_at: string } | null
}) {
  const { userId = 'user-1', tier = 'free', anglesCacheRow = null } = opts
  const client: any = {
    auth: {
      getUser: jest.fn(async () => ({ data: { user: { id: userId } } })),
    },
    from: jest.fn((table: string) => {
      if (table === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(async () => ({ data: { tier }, error: null })),
        }
      }
      if (table === 'content_angles_cache') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gt: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => ({ data: anglesCacheRow, error: null })),
        }
      }
      if (table === 'scan_results') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(async () => ({
            data: {
              id: 'sr-1',
              niche_label: 'Test Niche',
              channel_name: 'TestChan',
              language: 'en',
              content_type: 'howto',
              spike_multiplier: 2,
              subscriber_count: 5000,
              opportunity_score: 80,
            },
            error: null,
          })),
        }
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        single: jest.fn(async () => ({ data: null, error: null })),
        maybeSingle: jest.fn(async () => ({ data: null, error: null })),
      }
    }),
  }
  return client
}

/**
 * Build a minimal Supabase service client mock.
 * `todayPin` is the scan_result_id pinned for today, or null for none.
 * `anglesCacheRow` controls the content_angles_cache result for the demo path.
 */
function makeServiceClient(opts: {
  todayPin?: string | null
  anglesCacheRow?: { angles: object[]; expires_at: string } | null
}) {
  const { todayPin = null, anglesCacheRow = null } = opts
  const client: any = {
    from: jest.fn((table: string) => {
      if (table === 'daily_demo_niche') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => ({
            data: todayPin ? { scan_result_id: todayPin } : null,
            error: null,
          })),
        }
      }
      if (table === 'content_angles_cache') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gt: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => ({ data: anglesCacheRow, error: null })),
          upsert: jest.fn(async () => ({ error: null })),
        }
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        upsert: jest.fn(async () => ({ error: null })),
        maybeSingle: jest.fn(async () => ({ data: null, error: null })),
      }
    }),
  }
  return client
}

const CACHED_ANGLES_ROW = {
  angles: CACHED_ANGLES,
  expires_at: '2026-06-01T00:00:00.000Z',
}

function makeRequest(scanId: string, opts: { demoParam?: boolean; cookie?: string } = {}): Request {
  const url = opts.demoParam
    ? `https://app/api/content-angles/${scanId}?demo=1`
    : `https://app/api/content-angles/${scanId}`
  const headers: HeadersInit = {}
  if (opts.cookie) {
    headers['cookie'] = opts.cookie
  }
  return new Request(url, { headers })
}

// ─── Test setup ──────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
})

// ─── Auth guard ──────────────────────────────────────────────────────────

describe('GET /api/content-angles/[id] — auth', () => {
  it('returns 401 when user is not authenticated', async () => {
    const unauthClient: any = {
      auth: { getUser: jest.fn(async () => ({ data: { user: null } })) },
      from: jest.fn(),
    }
    mockedCreateClient.mockReturnValue(unauthClient)
    mockedCreateServiceClient.mockReturnValue(makeServiceClient({ todayPin: null }))

    const res = await GET(makeRequest('sr-1'), { params: { id: 'sr-1' } })
    expect(res.status).toBe(401)
  })
})

// ─── Demo bypass — 3-way gate ─────────────────────────────────────────────

describe('GET /api/content-angles/[id] — demo bypass gate', () => {
  it('FREE first-login (?demo=1 + cookie + match) → 200 with demo:true body', async () => {
    // readAnglesCache uses the user-scoped supabase client — must return the cache row
    mockedCreateClient.mockReturnValue(makeUserClient({ tier: 'free', anglesCacheRow: CACHED_ANGLES_ROW }))
    // Service client is called once for isTodaysDemoNiche
    mockedCreateServiceClient.mockReturnValue(makeServiceClient({ todayPin: 'sr-1' }))

    const res = await GET(
      makeRequest('sr-1', { demoParam: true, cookie: 'surgeniche_demo_seen=1' }),
      { params: { id: 'sr-1' } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.demo).toBe(true)
    expect(body.angles).toEqual(CACHED_ANGLES)
    // Tier check must NOT have run (checkAiQuota not called)
    expect(mockedCheckAiQuota).not.toHaveBeenCalled()
  })

  it('FREE returning user (no ?demo=1, no cookie, scan matches pin) → 403', async () => {
    mockedCreateClient.mockReturnValue(makeUserClient({ tier: 'free' }))
    mockedCreateServiceClient.mockReturnValue(makeServiceClient({ todayPin: 'sr-1' }))
    mockedCheckAiQuota.mockResolvedValue({ ok: false, reason: 'tier', tier: 'free' })

    const res = await GET(makeRequest('sr-1'), { params: { id: 'sr-1' } })
    expect(res.status).toBe(403)
  })

  it('FREE ?demo=1 but no cookie (URL forgery) → 403', async () => {
    mockedCreateClient.mockReturnValue(makeUserClient({ tier: 'free' }))
    // Service client for isTodaysDemoNiche still gets called to check pin
    mockedCreateServiceClient.mockReturnValue(makeServiceClient({ todayPin: 'sr-1' }))
    mockedCheckAiQuota.mockResolvedValue({ ok: false, reason: 'tier', tier: 'free' })

    const res = await GET(
      makeRequest('sr-1', { demoParam: true }), // no cookie
      { params: { id: 'sr-1' } },
    )
    expect(res.status).toBe(403)
  })

  it('FREE cookie present but no ?demo=1 → 403', async () => {
    mockedCreateClient.mockReturnValue(makeUserClient({ tier: 'free' }))
    mockedCreateServiceClient.mockReturnValue(makeServiceClient({ todayPin: 'sr-1' }))
    mockedCheckAiQuota.mockResolvedValue({ ok: false, reason: 'tier', tier: 'free' })

    const res = await GET(
      makeRequest('sr-1', { cookie: 'surgeniche_demo_seen=1' }), // no ?demo=1
      { params: { id: 'sr-1' } },
    )
    expect(res.status).toBe(403)
  })

  it('FREE ?demo=1 + cookie but scan mismatch → 403', async () => {
    mockedCreateClient.mockReturnValue(makeUserClient({ tier: 'free' }))
    // Today's pin is sr-OTHER, not sr-1
    mockedCreateServiceClient.mockReturnValue(makeServiceClient({ todayPin: 'sr-OTHER' }))
    mockedCheckAiQuota.mockResolvedValue({ ok: false, reason: 'tier', tier: 'free' })

    const res = await GET(
      makeRequest('sr-1', { demoParam: true, cookie: 'surgeniche_demo_seen=1' }),
      { params: { id: 'sr-1' } },
    )
    expect(res.status).toBe(403)
  })

  it('PREMIUM with no demo signal → 200 (bypass irrelevant, tier check passes)', async () => {
    mockedCreateClient.mockReturnValue(
      makeUserClient({ tier: 'premium', anglesCacheRow: CACHED_ANGLES_ROW }),
    )
    mockedCreateServiceClient.mockReturnValue(makeServiceClient({ todayPin: 'sr-1' }))
    mockedCheckAiQuota.mockResolvedValue({ ok: true, tier: 'premium', usedToday: 0, limit: Infinity })

    const res = await GET(makeRequest('sr-1'), { params: { id: 'sr-1' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    // Not a demo response
    expect(body.demo).toBeUndefined()
    expect(body.cached).toBe(true)
  })
})

// ─── Tier check paths ─────────────────────────────────────────────────────

describe('GET /api/content-angles/[id] — tier enforcement', () => {
  it('FREE tier with no demo bypass → 403', async () => {
    mockedCreateClient.mockReturnValue(makeUserClient({ tier: 'free' }))
    mockedCreateServiceClient.mockReturnValue(makeServiceClient({ todayPin: null }))
    mockedCheckAiQuota.mockResolvedValue({ ok: false, reason: 'tier', tier: 'free' })

    const res = await GET(makeRequest('sr-99'), { params: { id: 'sr-99' } })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.tier).toBe('free')
  })

  it('BASIC tier with quota available + cache hit → 200', async () => {
    mockedCreateClient.mockReturnValue(
      makeUserClient({ tier: 'basic', anglesCacheRow: CACHED_ANGLES_ROW }),
    )
    mockedCreateServiceClient.mockReturnValue(makeServiceClient({ todayPin: null }))
    mockedCheckAiQuota.mockResolvedValue({ ok: true, tier: 'basic', usedToday: 0, limit: 1 })

    const res = await GET(makeRequest('sr-1'), { params: { id: 'sr-1' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cached).toBe(true)
  })

  it('BASIC tier over daily limit → 429', async () => {
    mockedCreateClient.mockReturnValue(makeUserClient({ tier: 'basic' }))
    mockedCreateServiceClient.mockReturnValue(makeServiceClient({ todayPin: null }))
    mockedCheckAiQuota.mockResolvedValue({
      ok: false,
      reason: 'limit',
      tier: 'basic',
      usedToday: 1,
      limit: 1,
      resetAt: new Date('2026-05-26T00:00:00Z'),
    })

    const res = await GET(makeRequest('sr-1'), { params: { id: 'sr-1' } })
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toBe('daily_limit')
  })
})

// ─── Cookie parsing edge cases ────────────────────────────────────────────

describe('GET /api/content-angles/[id] — cookie parsing', () => {
  it('cookie present among multiple cookies → demo bypass succeeds', async () => {
    // readAnglesCache uses user-scoped supabase — provide the cache row there
    mockedCreateClient.mockReturnValue(makeUserClient({ tier: 'free', anglesCacheRow: CACHED_ANGLES_ROW }))
    mockedCreateServiceClient.mockReturnValue(makeServiceClient({ todayPin: 'sr-1' }))

    const res = await GET(
      makeRequest('sr-1', {
        demoParam: true,
        cookie: 'other_cookie=abc; surgeniche_demo_seen=1; another=xyz',
      }),
      { params: { id: 'sr-1' } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.demo).toBe(true)
  })

  it('cookie name is a prefix of another cookie → no false positive', async () => {
    mockedCreateClient.mockReturnValue(makeUserClient({ tier: 'free' }))
    mockedCreateServiceClient.mockReturnValue(makeServiceClient({ todayPin: 'sr-1' }))
    mockedCheckAiQuota.mockResolvedValue({ ok: false, reason: 'tier', tier: 'free' })

    const res = await GET(
      makeRequest('sr-1', {
        demoParam: true,
        // Note: no surgeniche_demo_seen cookie, only a different cookie starting with same prefix
        cookie: 'surgeniche_demo_seen_extra=1',
      }),
      { params: { id: 'sr-1' } },
    )
    expect(res.status).toBe(403)
  })
})
