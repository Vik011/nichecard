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

describe('TopNav active state (unified Discover surface)', () => {
  beforeEach(() => {
    mockPathname = '/discover'
    mockSearchParams = new URLSearchParams()
  })

  it('marks Discover active when on /discover root', () => {
    mockPathname = '/discover'
    render(<TopNav />)
    const discoverLink = screen.getByRole('link', { name: /discover/i })
    expect(discoverLink.getAttribute('aria-current')).toBe('page')
  })

  it('marks Discover active when on /discover with any query (mode=hot etc.)', () => {
    mockPathname = '/discover'
    mockSearchParams = new URLSearchParams('mode=hot')
    render(<TopNav />)
    const discoverLink = screen.getByRole('link', { name: /discover/i })
    expect(discoverLink.getAttribute('aria-current')).toBe('page')
  })

  it('marks Discover active for legacy /discover/longform path (the redirect target reaches /discover, but during transition the path may briefly be subroute)', () => {
    mockPathname = '/discover/longform'
    render(<TopNav />)
    const discoverLink = screen.getByRole('link', { name: /discover/i })
    expect(discoverLink.getAttribute('aria-current')).toBe('page')
  })

  it('marks My Channels active when on /dashboard', () => {
    mockPathname = '/dashboard'
    render(<TopNav />)
    const myChannelsLink = screen.getByRole('link', { name: /my channels/i })
    expect(myChannelsLink.getAttribute('aria-current')).toBe('page')
  })

  it('Discover link points to /discover (no type query)', () => {
    render(<TopNav />)
    const discoverLink = screen.getByRole('link', { name: /discover/i })
    expect(discoverLink.getAttribute('href')).toBe('/discover')
  })

  it('does not render legacy Shorts or Longform tabs', () => {
    render(<TopNav />)
    expect(screen.queryByRole('link', { name: /^shorts$/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /^longform$/i })).toBeNull()
  })

  it('renders the user avatar initial inside the trigger', () => {
    mockPathname = '/discover'
    render(<TopNav />)
    // Email is 'test@example.com' per the useUser mock → initial is 'T'
    expect(screen.getByTestId('user-avatar-initial')).toHaveTextContent('T')
  })
})
