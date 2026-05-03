'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserTier } from '@/lib/types/database'

interface UserContextValue {
  tier: UserTier
  loading: boolean
  isLoggedIn: boolean
  email: string | null
}

const UserContext = createContext<UserContextValue | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<UserTier>('free')
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [email, setEmail] = useState<string | null>(null)

  // Build a stable client once. We refresh state in two situations:
  // 1) on mount (initial session lookup)
  // 2) on every supabase auth event (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED…)
  // Without the auth-state subscription, signing out leaves the rest of the
  // app reading stale "logged in / tier=basic" values until a hard reload —
  // which is what produced the "shows Sign out even after logout" bug.
  const refresh = useCallback(async () => {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      setIsLoggedIn(false)
      setEmail(null)
      setTier('free')
      setLoading(false)
      return
    }
    setIsLoggedIn(true)
    setEmail(user.email ?? null)
    const { data, error: dbError } = await supabase
      .from('users')
      .select('tier')
      .eq('id', user.id)
      .single()
    if (dbError && process.env.NODE_ENV !== 'production') {
      console.error('[UserContext] DB error fetching tier:', dbError)
    }
    setTier((data?.tier as UserTier | undefined) ?? 'free')
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    refresh()

    const supabase = createClient()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, _session) => {
      // Re-pull the user + tier on every auth transition. We deliberately
      // ignore the session payload from the event and re-query so the tier
      // row from the `users` table is always fresh too (a Stripe webhook
      // promoting free→basic mid-session needs to take effect on the next
      // auth tick, not on a hard reload).
      if (cancelled) return
      refresh()
    })

    return () => {
      cancelled = true
      sub?.subscription.unsubscribe()
    }
  }, [refresh])

  return (
    <UserContext.Provider value={{ tier, loading, isLoggedIn, email }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (process.env.NODE_ENV !== 'production' && ctx === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return ctx as UserContextValue
}
