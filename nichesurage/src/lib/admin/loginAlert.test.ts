/** @jest-environment node */

const sentryBreadcrumbMock = jest.fn()
const sentryMessageMock = jest.fn()
jest.mock('@sentry/nextjs', () => ({
  addBreadcrumb: (...args: unknown[]) => sentryBreadcrumbMock(...args),
  captureMessage: (...args: unknown[]) => sentryMessageMock(...args),
}))

const sendAdminLoginAlertMock = jest.fn<Promise<{ ok: boolean; error?: string }>, unknown[]>()
jest.mock('@/lib/email/resend', () => ({
  sendAdminLoginAlert: (...args: unknown[]) => sendAdminLoginAlertMock(...args),
}))

import { fireAdminLoginAlert } from './loginAlert'

beforeEach(() => {
  sentryBreadcrumbMock.mockReset()
  sentryMessageMock.mockReset()
  sendAdminLoginAlertMock.mockReset()
  sendAdminLoginAlertMock.mockResolvedValue({ ok: true })
})

describe('fireAdminLoginAlert', () => {
  it('fires both Sentry breadcrumb and Resend email on the happy path', async () => {
    await fireAdminLoginAlert({
      adminEmail: 'admin@x.com',
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      ts: '2026-05-22T10:00:00Z',
    })
    expect(sentryBreadcrumbMock).toHaveBeenCalledTimes(1)
    expect(sentryMessageMock).toHaveBeenCalledTimes(1)
    expect(sendAdminLoginAlertMock).toHaveBeenCalledTimes(1)

    const crumb = sentryBreadcrumbMock.mock.calls[0][0] as Record<string, unknown>
    expect(crumb.category).toBe('admin.auth')
    expect(crumb.level).toBe('info')
    expect((crumb.data as Record<string, unknown>).ip).toBe('1.2.3.4')

    const [msg, level] = sentryMessageMock.mock.calls[0]
    expect(String(msg)).toContain('admin@x.com')
    expect(level).toBe('info')

    expect(sendAdminLoginAlertMock).toHaveBeenCalledWith({
      to: 'admin@x.com',
      ts: '2026-05-22T10:00:00Z',
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
    })
  })

  it('defaults ts to now() when not provided', async () => {
    const before = Date.now()
    await fireAdminLoginAlert({ adminEmail: 'a@x.com', ip: null, userAgent: null })
    const passedTs = (sendAdminLoginAlertMock.mock.calls[0][0] as { ts: string }).ts
    const t = new Date(passedTs).getTime()
    expect(t).toBeGreaterThanOrEqual(before)
    expect(t).toBeLessThanOrEqual(Date.now())
  })

  it('still fires email when Sentry throws', async () => {
    sentryBreadcrumbMock.mockImplementation(() => { throw new Error('sentry down') })
    sentryMessageMock.mockImplementation(() => { throw new Error('sentry down') })
    await expect(fireAdminLoginAlert({ adminEmail: 'a@x.com', ip: null, userAgent: null })).resolves.toBeUndefined()
    expect(sendAdminLoginAlertMock).toHaveBeenCalledTimes(1)
  })

  it('still fires Sentry when email rejects with thrown error', async () => {
    sendAdminLoginAlertMock.mockRejectedValueOnce(new Error('resend exploded'))
    await expect(fireAdminLoginAlert({ adminEmail: 'a@x.com', ip: null, userAgent: null })).resolves.toBeUndefined()
    expect(sentryBreadcrumbMock).toHaveBeenCalledTimes(1)
  })

  it('does not throw when email returns ok:false', async () => {
    sendAdminLoginAlertMock.mockResolvedValueOnce({ ok: false, error: 'no_api_key' })
    await expect(fireAdminLoginAlert({ adminEmail: 'a@x.com', ip: null, userAgent: null })).resolves.toBeUndefined()
  })
})
