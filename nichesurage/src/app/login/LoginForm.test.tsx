import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginForm } from './LoginForm'

// Sprint A.7 Phase 0 invariant: Google-only auth. Email/password and magic-
// link UI are intentionally absent — re-introducing them re-opens the fake-
// email abuse vector that the FREE tier rate limit depends on. These tests
// are guard rails: if someone adds back password fields by mistake, the
// suite goes red.

const signInWithOAuth = jest.fn()
const getUser = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
      getUser: (...args: unknown[]) => getUser(...args),
    },
  }),
}))

const mockSearchParams = { get: jest.fn() }
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}))

describe('LoginForm', () => {
  beforeEach(() => {
    signInWithOAuth.mockReset()
    signInWithOAuth.mockResolvedValue({ error: null })
    getUser.mockReset()
    // Default: no logged-in user. Tests that need an existing session
    // override this in their own setup.
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    mockSearchParams.get.mockReset()
    mockSearchParams.get.mockReturnValue(null)
  })

  it('renders the Google sign-in button', () => {
    render(<LoginForm />)
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })

  it('does NOT render password or email-only auth UI', () => {
    render(<LoginForm />)
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/you@example\.com/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^sign in$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /magic link/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/use magic link instead/i)).not.toBeInTheDocument()
  })

  it('triggers Google OAuth with the /auth/callback redirect on click', async () => {
    render(<LoginForm />)

    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }))

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1))
    const arg = signInWithOAuth.mock.calls[0][0]
    expect(arg.provider).toBe('google')
    expect(arg.options.redirectTo).toMatch(/\/auth\/callback/)
  })

  it('forwards plan + billing through the OAuth redirect when present', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'plan') return 'premium'
      if (key === 'billing') return 'yearly'
      return null
    })
    render(<LoginForm />)

    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }))

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1))
    const arg = signInWithOAuth.mock.calls[0][0]
    expect(arg.options.redirectTo).toMatch(/plan=premium/)
    expect(arg.options.redirectTo).toMatch(/billing=yearly/)
  })

  it('renders a checkout-intent notice when plan + billing are present', () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'plan') return 'basic'
      if (key === 'billing') return 'monthly'
      return null
    })
    render(<LoginForm />)
    expect(screen.getByText(/straight to checkout/i)).toBeInTheDocument()
    expect(screen.getByText(/Basic.*monthly/i)).toBeInTheDocument()
  })

  it('surfaces a callback error returned via ?error=', async () => {
    mockSearchParams.get.mockImplementation((key: string) =>
      key === 'error' ? 'oauth_failed' : null,
    )
    render(<LoginForm />)
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/oauth_failed/i),
    )
  })

  it('shows a redirect notice and disables the button while redirecting', async () => {
    // Make signInWithOAuth hang so we can observe the in-flight state.
    let resolve!: (v: { error: null }) => void
    signInWithOAuth.mockReturnValue(
      new Promise<{ error: null }>((r) => {
        resolve = r
      }),
    )
    render(<LoginForm />)

    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /redirecting to google/i })).toBeDisabled(),
    )
    resolve({ error: null })
  })

  it('skips OAuth and POSTs to /api/stripe/checkout when already logged in with checkout intent', async () => {
    // The "Basic user clicks Upgrade to Premium" path: the user is signed
    // in already, so we must NOT start a fresh OAuth (it rotates the
    // session cookies and breaks the auth-callback fetch). Instead we
    // POST to the checkout endpoint with the current cookies and redirect
    // straight to the Stripe URL.
    getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'vik@example.com' } },
      error: null,
    })
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'plan') return 'premium'
      if (key === 'billing') return 'monthly'
      return null
    })

    // We hang the json() promise so the test can assert the fetch call
    // shape without ever reaching the `window.location.href = url`
    // assignment that jsdom can't faithfully simulate.
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: () => new Promise(() => {}),
    })
    global.fetch = fetchSpy as unknown as typeof fetch

    render(<LoginForm />)
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/stripe/checkout')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string) as { tier: string; interval: string }
    expect(body).toEqual({ tier: 'premium', interval: 'monthly' })
    // The fresh OAuth flow must NOT fire on this path.
    expect(signInWithOAuth).not.toHaveBeenCalled()
  })

  it('does NOT auto-checkout when callback bounced back with an error', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'vik@example.com' } },
      error: null,
    })
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'plan') return 'premium'
      if (key === 'billing') return 'monthly'
      if (key === 'error') return 'previous_failure'
      return null
    })

    const fetchSpy = jest.fn()
    global.fetch = fetchSpy as unknown as typeof fetch

    render(<LoginForm />)
    // The error message should surface and we should not retry automatically.
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/previous_failure/i),
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
