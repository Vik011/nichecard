/**
 * @jest-environment node
 *
 * Contract tests for the server-side Turnstile verifier. We mock fetch so no
 * real Cloudflare call goes out during the test run.
 */

import { verifyTurnstileToken } from './verify'

const ORIGINAL_ENV = process.env

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
  process.env.TURNSTILE_SECRET_KEY = 'secret_test'
  delete process.env.TURNSTILE_DEV_BYPASS
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

function fakeFetch(response: { success: boolean; 'error-codes'?: string[] }, status = 200): typeof fetch {
  return jest.fn().mockResolvedValue({
    json: async () => response,
    status,
  }) as unknown as typeof fetch
}

describe('verifyTurnstileToken', () => {
  it('returns success=true on a Cloudflare success response', async () => {
    const fetchMock = fakeFetch({ success: true })
    const out = await verifyTurnstileToken('tok-123', '1.2.3.4', fetchMock)
    expect(out.success).toBe(true)
    expect(out.errorCodes).toEqual([])
  })

  it('forwards secret + token + ip to Cloudflare', async () => {
    const fetchMock = fakeFetch({ success: true })
    await verifyTurnstileToken('tok-123', '1.2.3.4', fetchMock)

    const [, init] = (fetchMock as jest.Mock).mock.calls[0]
    const body = init.body as URLSearchParams
    expect(body.get('secret')).toBe('secret_test')
    expect(body.get('response')).toBe('tok-123')
    expect(body.get('remoteip')).toBe('1.2.3.4')
  })

  it('returns success=false with error codes when Cloudflare rejects', async () => {
    const fetchMock = fakeFetch({ success: false, 'error-codes': ['invalid-input-response'] })
    const out = await verifyTurnstileToken('bad-tok', undefined, fetchMock)
    expect(out.success).toBe(false)
    expect(out.errorCodes).toEqual(['invalid-input-response'])
  })

  it('returns missing-input-response when token is empty', async () => {
    const fetchMock = fakeFetch({ success: true })
    const out = await verifyTurnstileToken('', undefined, fetchMock)
    expect(out.success).toBe(false)
    expect(out.errorCodes).toEqual(['missing-input-response'])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns missing-secret when env var is unset', async () => {
    delete process.env.TURNSTILE_SECRET_KEY
    const fetchMock = fakeFetch({ success: true })
    const out = await verifyTurnstileToken('tok', undefined, fetchMock)
    expect(out.success).toBe(false)
    expect(out.errorCodes).toEqual(['missing-secret'])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('honours TURNSTILE_DEV_BYPASS=1 when secret is unset (dev escape hatch)', async () => {
    delete process.env.TURNSTILE_SECRET_KEY
    process.env.TURNSTILE_DEV_BYPASS = '1'
    const fetchMock = fakeFetch({ success: true })
    const out = await verifyTurnstileToken('whatever', undefined, fetchMock)
    expect(out.success).toBe(true)
    expect(out.errorCodes).toEqual(['dev-bypass'])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('treats network errors as a failed verification (fail-closed)', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch
    const out = await verifyTurnstileToken('tok', undefined, fetchMock)
    expect(out.success).toBe(false)
    expect(out.errorCodes).toEqual(['network-error'])
  })

  it('omits remoteip from the body when not provided', async () => {
    const fetchMock = fakeFetch({ success: true })
    await verifyTurnstileToken('tok', undefined, fetchMock)
    const [, init] = (fetchMock as jest.Mock).mock.calls[0]
    const body = init.body as URLSearchParams
    expect(body.has('remoteip')).toBe(false)
  })
})
