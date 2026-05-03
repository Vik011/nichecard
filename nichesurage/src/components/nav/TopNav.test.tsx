import { render, screen } from '@testing-library/react'
import { TopNav } from './TopNav'

let mockPathname = '/discover'
let mockSearchParams = new URLSearchParams()
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}))

jest.mock('@/lib/context/UserContext', () => ({
  useUser: () => ({ email: 'test@example.com', tier: 'free', loading: false, isLoggedIn: true }),
}))

jest.mock('@/lib/i18n/useLang', () => ({
  useLang: () => ['en', () => {}] as const,
}))

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: jest.fn() } }),
}))

describe('TopNav active state', () => {
  beforeEach(() => {
    mockPathname = '/discover'
    mockSearchParams = new URLSearchParams()
  })

  it('marks Shorts active when on /discover with no type param (shorts is the default)', () => {
    mockPathname = '/discover'
    mockSearchParams = new URLSearchParams()
    render(<TopNav />)
    const shortsLink = screen.getByRole('link', { name: /shorts/i })
    expect(shortsLink.getAttribute('aria-current')).toBe('page')
  })

  it('marks Shorts active when on /discover?type=shorts', () => {
    mockPathname = '/discover'
    mockSearchParams = new URLSearchParams('type=shorts')
    render(<TopNav />)
    const shortsLink = screen.getByRole('link', { name: /shorts/i })
    expect(shortsLink.getAttribute('aria-current')).toBe('page')
    const longformLink = screen.getByRole('link', { name: /longform/i })
    expect(longformLink.getAttribute('aria-current')).toBeNull()
  })

  it('marks Longform active when on /discover?type=longform', () => {
    mockPathname = '/discover'
    mockSearchParams = new URLSearchParams('type=longform')
    render(<TopNav />)
    const longformLink = screen.getByRole('link', { name: /longform/i })
    expect(longformLink.getAttribute('aria-current')).toBe('page')
    const shortsLink = screen.getByRole('link', { name: /shorts/i })
    expect(shortsLink.getAttribute('aria-current')).toBeNull()
  })

  it('marks Saved active when on /dashboard', () => {
    mockPathname = '/dashboard'
    mockSearchParams = new URLSearchParams()
    render(<TopNav />)
    const savedLink = screen.getByRole('link', { name: /saved/i })
    expect(savedLink.getAttribute('aria-current')).toBe('page')
  })

  it('shorts/longform tab hrefs point directly to /discover with type query (skip the redirect)', () => {
    mockPathname = '/discover'
    mockSearchParams = new URLSearchParams()
    render(<TopNav />)
    const shortsLink = screen.getByRole('link', { name: /shorts/i })
    expect(shortsLink.getAttribute('href')).toBe('/discover?type=shorts')
    const longformLink = screen.getByRole('link', { name: /longform/i })
    expect(longformLink.getAttribute('href')).toBe('/discover?type=longform')
  })
})
