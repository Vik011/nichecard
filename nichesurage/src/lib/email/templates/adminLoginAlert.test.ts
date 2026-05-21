import { renderAdminLoginAlertEmail, ADMIN_LOGIN_ALERT_SUBJECT } from './adminLoginAlert'

describe('renderAdminLoginAlertEmail', () => {
  const input = {
    ts: '2026-05-22T10:00:00Z',
    ip: '1.2.3.4',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  }

  it('includes the timestamp', () => {
    const html = renderAdminLoginAlertEmail(input)
    expect(html).toContain('2026-05-22T10:00:00Z')
  })

  it('includes the IP address', () => {
    const html = renderAdminLoginAlertEmail(input)
    expect(html).toContain('1.2.3.4')
  })

  it('includes the user agent', () => {
    const html = renderAdminLoginAlertEmail(input)
    expect(html).toContain('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
  })

  it('renders "unknown" when ip is null', () => {
    const html = renderAdminLoginAlertEmail({ ...input, ip: null })
    expect(html).toContain('unknown')
    expect(html).not.toContain('1.2.3.4')
  })

  it('renders "unknown" when userAgent is null', () => {
    const html = renderAdminLoginAlertEmail({ ...input, userAgent: null })
    expect(html).toContain('unknown')
  })

  it('escapes HTML in the user agent (defense vs malicious UA)', () => {
    const html = renderAdminLoginAlertEmail({ ...input, userAgent: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('exposes a stable subject line', () => {
    expect(ADMIN_LOGIN_ALERT_SUBJECT).toBe('SurgeNiche Admin: sign-in detected')
  })

  it('contains no em-dash or en-dash characters (per copy guidelines)', () => {
    const html = renderAdminLoginAlertEmail(input)
    expect(html).not.toContain('—')
    expect(html).not.toContain('–')
  })
})
