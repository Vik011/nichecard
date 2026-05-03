// Verifies the shared Sentry scrubbing logic strips secrets from
// request headers, URLs, and breadcrumbs. The same module is used by
// client/server/edge Sentry runtimes; one test suite covers all three.
import { scrubSentryEvent } from '../../../sentry.shared'

describe('scrubSentryEvent', () => {
  it('strips authorization, cookie, and stripe-signature headers', () => {
    const event = {
      request: {
        headers: {
          'authorization': 'Bearer secret-token',
          'Authorization': 'Bearer secret-token',
          'cookie': 'session=abc',
          'Cookie': 'session=abc',
          'x-stripe-signature': 't=12345,v1=abc',
          'Stripe-Signature': 't=12345,v1=abc',
          'user-agent': 'Mozilla/5.0',
        },
      },
    }
    const out = scrubSentryEvent(event)
    expect(out.request.headers['authorization']).toBeUndefined()
    expect(out.request.headers['Authorization']).toBeUndefined()
    expect(out.request.headers['cookie']).toBeUndefined()
    expect(out.request.headers['Cookie']).toBeUndefined()
    expect(out.request.headers['x-stripe-signature']).toBeUndefined()
    expect(out.request.headers['Stripe-Signature']).toBeUndefined()
    // Non-sensitive headers stay.
    expect(out.request.headers['user-agent']).toBe('Mozilla/5.0')
  })

  it('redacts sensitive URL query params', () => {
    const event = {
      request: {
        url: 'https://surgeniche.com/auth/callback?token=abc&access_token=xyz&user_id=123',
      },
    }
    const out = scrubSentryEvent(event)
    expect(out.request.url).toContain('token=%5Bredacted%5D')
    expect(out.request.url).toContain('access_token=%5Bredacted%5D')
    // Non-sensitive params stay.
    expect(out.request.url).toContain('user_id=123')
    // Original secret values are gone.
    expect(out.request.url).not.toContain('abc')
    expect(out.request.url).not.toContain('xyz')
  })

  it('handles relative URLs gracefully', () => {
    const event = {
      request: {
        url: '/api/something?secret=foo&id=42',
      },
    }
    const out = scrubSentryEvent(event)
    expect(out.request.url).toContain('secret=%5Bredacted%5D')
    expect(out.request.url).toContain('id=42')
  })

  it('scrubs URLs inside breadcrumbs (data.url AND data.to)', () => {
    const event = {
      breadcrumbs: [
        { category: 'fetch', data: { url: 'https://x.com/api?token=leak' } },
        { category: 'navigation', data: { to: '/auth?jwt=leak' } },
        { category: 'log', data: {} }, // no url, should not crash
        { category: 'log' }, // no data, should not crash
      ],
    }
    const out = scrubSentryEvent(event)
    expect(out.breadcrumbs[0].data.url).toContain('token=%5Bredacted%5D')
    expect(out.breadcrumbs[0].data.url).not.toContain('leak')
    expect(out.breadcrumbs[1].data.to).toContain('jwt=%5Bredacted%5D')
    expect(out.breadcrumbs[1].data.to).not.toContain('leak')
  })

  it('passes through events with no request or breadcrumbs', () => {
    expect(() => scrubSentryEvent({})).not.toThrow()
    expect(() => scrubSentryEvent({ message: 'hi' })).not.toThrow()
  })

  it('case-insensitive matching of sensitive keys', () => {
    const event = {
      request: {
        url: 'https://x.com/?Token=abc&PASSWORD=xyz&apiKey=foo',
      },
    }
    const out = scrubSentryEvent(event)
    expect(out.request.url).toContain('Token=%5Bredacted%5D')
    expect(out.request.url).toContain('PASSWORD=%5Bredacted%5D')
    expect(out.request.url).toContain('apiKey=%5Bredacted%5D')
  })

  it('preserves non-sensitive query params', () => {
    const event = {
      request: { url: 'https://x.com/?page=2&sort=desc&id=42' },
    }
    const out = scrubSentryEvent(event)
    // Original params untouched.
    expect(out.request.url).toContain('page=2')
    expect(out.request.url).toContain('sort=desc')
    expect(out.request.url).toContain('id=42')
    expect(out.request.url).not.toContain('redacted')
  })
})
