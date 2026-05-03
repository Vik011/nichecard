import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { UserProvider, useUser } from './UserContext'

jest.mock('@/lib/supabase/client')

import { createClient } from '@/lib/supabase/client'

const mockCreateClient = createClient as jest.Mock

function makeSupabaseMock({
  user = null as { id: string; email: string | undefined } | null,
  getUserError = null as object | null,
  dbTier = null as string | null,
} = {}) {
  const single = jest.fn().mockResolvedValue({
    data: dbTier ? { tier: dbTier } : null,
    error: null,
  })
  const eq = jest.fn().mockReturnValue({ single })
  const select = jest.fn().mockReturnValue({ eq })
  const from = jest.fn().mockReturnValue({ select })
  // Subscription stub for onAuthStateChange — we don't fire any auth events
  // in these unit tests; we just need a no-op subscription with a working
  // unsubscribe so the provider's cleanup effect doesn't blow up on unmount.
  const unsubscribe = jest.fn()
  const onAuthStateChange = jest.fn().mockReturnValue({
    data: { subscription: { unsubscribe } },
  })
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: getUserError,
      }),
      onAuthStateChange,
    },
    from,
  }
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <UserProvider>{children}</UserProvider>
)

describe('useUser', () => {
  beforeEach(() => {
    mockCreateClient.mockReset()
  })

  it('returns isLoggedIn:true, tier:"basic" and email for a logged-in basic user', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabaseMock({ user: { id: 'user-1', email: 'basic@example.com' }, dbTier: 'basic' })
    )
    const { result } = renderHook(() => useUser(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tier).toBe('basic')
    expect(result.current.isLoggedIn).toBe(true)
    expect(result.current.email).toBe('basic@example.com')
  })

  it('returns isLoggedIn:true, tier:"premium" and email for a logged-in premium user', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabaseMock({ user: { id: 'user-2', email: 'premium@example.com' }, dbTier: 'premium' })
    )
    const { result } = renderHook(() => useUser(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tier).toBe('premium')
    expect(result.current.isLoggedIn).toBe(true)
    expect(result.current.email).toBe('premium@example.com')
  })

  it('returns isLoggedIn:false, tier:"free" and null email for an unauthenticated user', async () => {
    mockCreateClient.mockReturnValue(makeSupabaseMock({ user: null }))
    const { result } = renderHook(() => useUser(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tier).toBe('free')
    expect(result.current.isLoggedIn).toBe(false)
    expect(result.current.email).toBeNull()
  })

  it('returns isLoggedIn:false, tier:"free" when getUser returns an error', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabaseMock({ getUserError: new Error('network error') })
    )
    const { result } = renderHook(() => useUser(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tier).toBe('free')
    expect(result.current.isLoggedIn).toBe(false)
    expect(result.current.email).toBeNull()
  })

  it('returns null email when authUser.email is undefined', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabaseMock({ user: { id: 'user-3', email: undefined as unknown as string }, dbTier: 'basic' })
    )
    const { result } = renderHook(() => useUser(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isLoggedIn).toBe(true)
    expect(result.current.email).toBeNull()
  })
})
