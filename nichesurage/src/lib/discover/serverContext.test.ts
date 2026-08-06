/** @jest-environment node */

import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveSessionUser, resolveTodayPinId } from './serverContext'

interface MockOpts {
  user?: { id: string } | null
  tierRow?: { tier: string } | null
  pinRow?: { scan_result_id: string } | null
}

// Minimal Supabase client mock supporting the exact read chains used:
//   auth.getUser()
//   from('users').select('tier').eq('id', x).single()
//   from('daily_demo_niche').select('scan_result_id').eq('date', x).maybeSingle()
// Writes (insert/update/upsert) are intentionally NOT implemented, so any
// attempt to write would throw — proving resolveTodayPinId is read-only.
function mockClient(opts: MockOpts): SupabaseClient {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: opts.user ?? null } }),
    },
    from: jest.fn((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: opts.tierRow ?? null }) }) }),
        }
      }
      if (table === 'daily_demo_niche') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: opts.pinRow ?? null }) }) }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    }),
  } as unknown as SupabaseClient
}

describe('resolveSessionUser', () => {
  it('returns userId + tier from public.users', async () => {
    const res = await resolveSessionUser(mockClient({ user: { id: 'u1' }, tierRow: { tier: 'premium' } }))
    expect(res).toEqual({ userId: 'u1', tier: 'premium' })
  })

  it('fails closed: no session → userId null, tier free', async () => {
    const res = await resolveSessionUser(mockClient({ user: null }))
    expect(res).toEqual({ userId: null, tier: 'free' })
  })

  it('defaults to free when the users row is missing', async () => {
    const res = await resolveSessionUser(mockClient({ user: { id: 'u2' }, tierRow: null }))
    expect(res).toEqual({ userId: 'u2', tier: 'free' })
  })
})

describe('resolveTodayPinId', () => {
  it('returns the scan_result_id for today (read-only)', async () => {
    const pin = await resolveTodayPinId(mockClient({ pinRow: { scan_result_id: 'sr-pin' } }))
    expect(pin).toBe('sr-pin')
  })

  it('returns null when no pin exists yet today', async () => {
    const pin = await resolveTodayPinId(mockClient({ pinRow: null }))
    expect(pin).toBeNull()
  })
})
