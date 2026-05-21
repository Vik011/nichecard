/** @jest-environment node */

// ─── Mocks ────────────────────────────────────────────────────────────────
const exchangeMock = jest.fn<Promise<{ error: null | { message: string } }>, [string]>()
const getUserMock = jest.fn<Promise<{ data: { user: { id: string; email: string; user_metadata?: Record<string, unknown> } | null }; error: null | { message: string } }>, []>()
const profileMaybeSingleMock = jest.fn()
const sendWelcomeMock = jest.fn<Promise<{ ok: boolean; error?: string }>, unknown[]>()
const fireLoginAlertMock = jest.fn<Promise<void>, unknown[]>()
const getDailyDemoNicheMock = jest.fn()
const preWarmMock = jest.fn()
const isAdminEmailMock = jest.fn<boolean, [string | null | undefined]>()
const assertAdminIsActiveMock = jest.fn<Promise<boolean>, [string]>()

function buildSupabaseServer() {
  const profileChain = {
    select: () => profileChain,
    eq: () => profileChain,
    maybeSingle: () => profileMaybeSingleMock(),
    update: () => ({
      eq: () => Promise.resolve({ error: null }),
    }),
  }
  return {
    auth: {
      exchangeCodeForSession: (code: string) => exchangeMock(code),
      getUser: () => getUserMock(),
    },
    from: (_table: string) => profileChain,
  }
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => buildSupabaseServer(),
}))
jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => buildSupabaseServer(),
}))
jest.mock('@/lib/email/resend', () => ({
  sendWelcomeEmail: (...args: unknown[]) => sendWelcomeMock(...args),
}))
jest.mock('@/lib/admin/loginAlert', () => ({
  fireAdminLoginAlert: (...args: unknown[]) => fireLoginAlertMock(...args),
}))
jest.mock('@/lib/admin/auth', () => ({
  isAdminEmail: (...args: unknown[]) => isAdminEmailMock(...(args as [string | null | undefined])),
  assertAdminIsActive: (...args: unknown[]) => assertAdminIsActiveMock(...(args as [string])),
}))
jest.mock('@/lib/tier/freeDemo', () => ({
  getDailyDemoNiche: (...args: unknown[]) => getDailyDemoNicheMock(...args),
}))
jest.mock('@/lib/demo/preWarm', () => ({
  preWarmDemoNiche: (...args: unknown[]) => preWarmMock(...args),
}))

import { GET } from './route'

// Helper to construct a NextRequest-like object the route handler accepts.
function buildRequest(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers: new Headers(headers) })
}

beforeEach(() => {
  exchangeMock.mockReset()
  getUserMock.mockReset()
  profileMaybeSingleMock.mockReset()
  sendWelcomeMock.mockReset()
  fireLoginAlertMock.mockReset()
  getDailyDemoNicheMock.mockReset()
  preWarmMock.mockReset()
  isAdminEmailMock.mockReset()
  assertAdminIsActiveMock.mockReset()

  // Defaults: exchange succeeds, no welcome retry needed, no first-login demo.
  exchangeMock.mockResolvedValue({ error: null })
  sendWelcomeMock.mockResolvedValue({ ok: true })
  fireLoginAlertMock.mockResolvedValue(undefined)
  getDailyDemoNicheMock.mockResolvedValue(null) // cold start: skip demo branch
  profileMaybeSingleMock.mockResolvedValue({ data: { welcome_email_sent_at: '2026-05-01T00:00:00Z', first_login_at: '2026-05-01T00:00:00Z' }, error: null })
})

describe('GET /auth/callback admin login alert', () => {
  it('fires the alert when the signed-in user passes the dual admin gate', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u-admin', email: 'admin@x.com' } }, error: null })
    isAdminEmailMock.mockReturnValue(true)
    assertAdminIsActiveMock.mockResolvedValue(true)

    await GET(buildRequest('https://app.x/auth/callback?code=c', { 'x-forwarded-for': '1.2.3.4, 5.6.7.8', 'user-agent': 'TestUA' }) as unknown as Parameters<typeof GET>[0])

    expect(fireLoginAlertMock).toHaveBeenCalledTimes(1)
    expect(fireLoginAlertMock).toHaveBeenCalledWith(expect.objectContaining({
      adminEmail: 'admin@x.com',
      ip: '1.2.3.4',
      userAgent: 'TestUA',
    }))
  })

  it('does NOT fire the alert when env gate passes but DB gate fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u-fake', email: 'admin@x.com' } }, error: null })
    isAdminEmailMock.mockReturnValue(true)
    assertAdminIsActiveMock.mockResolvedValue(false)

    await GET(buildRequest('https://app.x/auth/callback?code=c') as unknown as Parameters<typeof GET>[0])
    expect(fireLoginAlertMock).not.toHaveBeenCalled()
  })

  it('does NOT fire the alert for non-admin email', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u-user', email: 'user@x.com' } }, error: null })
    isAdminEmailMock.mockReturnValue(false)

    await GET(buildRequest('https://app.x/auth/callback?code=c') as unknown as Parameters<typeof GET>[0])
    expect(fireLoginAlertMock).not.toHaveBeenCalled()
    expect(assertAdminIsActiveMock).not.toHaveBeenCalled() // short-circuited
  })

  it('does NOT crash the callback when fireAdminLoginAlert rejects', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u-admin', email: 'admin@x.com' } }, error: null })
    isAdminEmailMock.mockReturnValue(true)
    assertAdminIsActiveMock.mockResolvedValue(true)
    fireLoginAlertMock.mockRejectedValueOnce(new Error('alert path crashed'))

    const resp = await GET(buildRequest('https://app.x/auth/callback?code=c') as unknown as Parameters<typeof GET>[0])
    expect(resp.status).toBe(307) // NextResponse.redirect default
  })
})
