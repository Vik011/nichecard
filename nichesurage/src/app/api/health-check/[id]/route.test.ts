/**
 * @jest-environment node
 *
 * Tests for GET /api/health-check/[id]
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

// Health check computation (deterministic output for tests)
jest.mock('@/lib/health-check/score', () => ({
  computeHealthScore: jest.fn(() => ({ score: 72, components: {} })),
}))

jest.mock('@/lib/health-check/verdict', () => ({
  generateVerdict: jest.fn(async () => 'Good niche'),
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

/**
 * Build a minimal Supabase user-scoped client mock.
 * `tier` sets what the `users` table returns.
 * `healthCacheRow` is what `niche_health_checks` returns (or null = no cache).
 */
function makeUserClient(opts: {
  userId?: string
  tier?: 'free' | 'basic' | 'premium'
  healthCacheRow?: { health_score: number; components: object; verdict_text: string; expires_at: string } | null
}) {
  const { userId = 'user-1', tier = 'free', healthCacheRow = null } = opts
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
      if (table === 'niche_health_checks') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gt: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => ({ data: healthCacheRow, error: null })),
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
              opportunity_score: 80,
              engagement_rate: 0.05,
              virality_rating: 7,
              subscriber_count: 5000,
              views_48h: 10000,
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
 * `healthCacheRow` controls the niche_health_checks result for the demo path.
 */
function makeServiceClient(opts: {
  todayPin?: string | null
  healthCacheRow?: { health_score: number; components: object; verdict_text: string; expires_at: string } | null
}) {
  const { todayPin = null, healthCacheRow = null } = opts
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
      if (table === 'niche_health_checks') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gt: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => ({ data: healthCacheRow, error: null })),
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

const CACHED_HEALTH = {
  health_score: 85,
  components: { growth: 90, engagement: 80 },
  verdict_text: 'Strong niche',
  expires_at: '2026-06-01T00:00:00.000Z',
}

function makeRequest(scanId: string, opts: { demoParam?: boolean; cookie?: string } = {}): Request {
  const url = opts.demoParam
    ? `https://app/api/health-check/${scanId}?demo=1`
    : `https://app/api/health-check/${scanId}`
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

describe('GET /api/health-check/[id] — auth', () => {
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

describe('GET /api/health-check/[id] — demo bypass gate', () => {
  it('FREE first-login (?demo=1 + cookie + match) → 200 with demo:true body', async () => {
    // readHealthCache uses the user-scoped supabase client — must return the cache row
    mockedCreateClient.mockReturnValue(makeUserClient({ tier: 'free', healthCacheRow: CACHED_HEALTH }))
    // Service client is called once for isTodaysDemoNiche
    mockedCreateServiceClient.mockReturnValue(makeServiceClient({ todayPin: 'sr-1' }))

    const res = await GET(
      makeRequest('sr-1', { demoParam: true, cookie: 'surgeniche_demo_seen=1' }),
      { params: { id: 'sr-1' } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.demo).toBe(true)
    expect(body.score).toBe(CACHED_HEALTH.health_score)
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
      makeUserClient({ tier: 'premium', healthCacheRow: CACHED_HEALTH }),
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

describe('GET /api/health-check/[id] — tier enforcement', () => {
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
      makeUserClient({ tier: 'basic', healthCacheRow: CACHED_HEALTH }),
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

describe('GET /api/health-check/[id] — cookie parsing', () => {
  it('cookie present among multiple cookies → demo bypass succeeds', async () => {
    // readHealthCache uses user-scoped supabase — provide the cache row there
    mockedCreateClient.mockReturnValue(makeUserClient({ tier: 'free', healthCacheRow: CACHED_HEALTH }))
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
