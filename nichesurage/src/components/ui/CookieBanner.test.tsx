import { render, screen, fireEvent, act } from '@testing-library/react'
import { CookieBanner } from './CookieBanner'

// Mock next/link to avoid router dependency in tests
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
  MockLink.displayName = 'MockLink'
  return MockLink
})

const mockOptIn = jest.fn()
const mockOptOut = jest.fn()

function setupPosthogMock() {
  Object.defineProperty(window, 'posthog', {
    value: {
      opt_in_capturing: mockOptIn,
      opt_out_capturing: mockOptOut,
    },
    writable: true,
    configurable: true,
  })
}

describe('CookieBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    mockOptIn.mockReset()
    mockOptOut.mockReset()
    setupPosthogMock()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders the banner after 500ms when no consent is stored', async () => {
    render(<CookieBanner />)

    // Banner should not be visible yet
    expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument()

    // Advance timers past the 500ms delay
    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    expect(screen.getByText(/we use cookies/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument()
  })

  it('does NOT render the banner when consent is already "accepted"', async () => {
    localStorage.setItem('cookie_consent', 'accepted')
    render(<CookieBanner />)

    await act(async () => {
      jest.advanceTimersByTime(600)
    })

    expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument()
  })

  it('does NOT render the banner when consent is already "declined"', async () => {
    localStorage.setItem('cookie_consent', 'declined')
    render(<CookieBanner />)

    await act(async () => {
      jest.advanceTimersByTime(600)
    })

    expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument()
  })

  it('clicking Accept sets localStorage to "accepted" and hides the banner', async () => {
    render(<CookieBanner />)

    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    expect(screen.getByText(/we use cookies/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /accept/i }))

    expect(localStorage.getItem('cookie_consent')).toBe('accepted')
    expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument()
  })

  it('clicking Decline sets localStorage to "declined" and hides the banner', async () => {
    render(<CookieBanner />)

    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    expect(screen.getByText(/we use cookies/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /decline/i }))

    expect(localStorage.getItem('cookie_consent')).toBe('declined')
    expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument()
  })

  it('clicking Accept calls posthog.opt_in_capturing', async () => {
    render(<CookieBanner />)

    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    fireEvent.click(screen.getByRole('button', { name: /accept/i }))

    expect(mockOptIn).toHaveBeenCalledTimes(1)
    expect(mockOptOut).not.toHaveBeenCalled()
  })

  it('clicking Decline calls posthog.opt_out_capturing', async () => {
    render(<CookieBanner />)

    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    fireEvent.click(screen.getByRole('button', { name: /decline/i }))

    expect(mockOptOut).toHaveBeenCalledTimes(1)
    expect(mockOptIn).not.toHaveBeenCalled()
  })

  it('renders a link to /privacy', async () => {
    render(<CookieBanner />)

    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    const link = screen.getByRole('link', { name: /privacy policy/i })
    expect(link).toHaveAttribute('href', '/privacy')
  })
})
