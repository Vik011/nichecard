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
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: getUserError,
      }),
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

  it('returns user object, tier:"basic" and loading:false for a logged-in basic user', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabaseMock({ user: { id: 'user-1', email: 'basic@example.com' }, dbTier: 'basic' })
    )
    const { result } = renderHook(() => useUser(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tier).toBe('basic')
    expect(result.current.user).toEqual({ id: 'user-1', email: 'basic@example.com' })
  })

  it('returns user object, tier:"premium" and loading:false for a logged-in premium user', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabaseMock({ user: { id: 'user-2', email: 'premium@example.com' }, dbTier: 'premium' })
    )
    const { result } = renderHook(() => useUser(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tier).toBe('premium')
    expect(result.current.user).toEqual({ id: 'user-2', email: 'premium@example.com' })
  })

  it('returns user:null, tier:"free" and loading:false for an unauthenticated user', async () => {
    mockCreateClient.mockReturnValue(makeSupabaseMock({ user: null }))
    const { result } = renderHook(() => useUser(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tier).toBe('free')
    expect(result.current.user).toBeNull()
  })

  it('returns user:null, tier:"free" and loading:false when getUser returns an error', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabaseMock({ getUserError: new Error('network error') })
    )
    const { result } = renderHook(() => useUser(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tier).toBe('free')
    expect(result.current.user).toBeNull()
  })

  it('returns user with null email when authUser.email is undefined', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabaseMock({ user: { id: 'user-3', email: undefined as unknown as string }, dbTier: 'basic' })
    )
    const { result } = renderHook(() => useUser(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toEqual({ id: 'user-3', email: null })
  })
})
