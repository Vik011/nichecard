import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginForm } from './LoginForm'

// Sprint A.7 Phase 0 invariant: Google-only auth. Email/password and magic-
// link UI are intentionally absent — re-introducing them re-opens the fake-
// email abuse vector that the FREE tier rate limit depends on. These tests
// are guard rails: if someone adds back password fields by mistake, the
// suite goes red.

const signInWithOAuth = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
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
})
