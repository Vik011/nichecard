import { renderWelcomeEmail, WELCOME_SUBJECT } from './welcome'

describe('renderWelcomeEmail', () => {
  it('uses the provided first name in the greeting', () => {
    const html = renderWelcomeEmail({ firstName: 'Viktor' })
    expect(html).toContain('Hi Viktor,')
  })

  it('falls back to "Hi there," when firstName is null', () => {
    const html = renderWelcomeEmail({ firstName: null })
    expect(html).toContain('Hi there,')
  })

  it('falls back when firstName is whitespace only', () => {
    const html = renderWelcomeEmail({ firstName: '   ' })
    expect(html).toContain('Hi there,')
  })

  it('escapes HTML special characters in the name (defense vs. odd Google profile names)', () => {
    const html = renderWelcomeEmail({ firstName: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('links the CTA button to https://surgeniche.com/trending', () => {
    const html = renderWelcomeEmail({ firstName: 'Viktor' })
    expect(html).toContain('href="https://surgeniche.com/trending"')
  })

  it('contains no em-dash or en-dash characters (per copy guidelines)', () => {
    const html = renderWelcomeEmail({ firstName: 'Viktor' })
    expect(html).not.toContain('—') // em-dash
    expect(html).not.toContain('–') // en-dash
  })

  it('exposes a stable subject line', () => {
    expect(WELCOME_SUBJECT).toBe('Welcome to SurgeNiche')
  })
})
