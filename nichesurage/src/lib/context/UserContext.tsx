'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserTier } from '@/lib/types/database'

interface UserContextValue {
  tier: UserTier
  loading: boolean
}

const UserContext = createContext<UserContextValue | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<UserTier>('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function fetchTier() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return
        const { data, error: dbError } = await supabase
          .from('users')
          .select('tier')
          .eq('id', user.id)
          .single()
        if (dbError && process.env.NODE_ENV !== 'production') {
          console.error('[UserContext] DB error fetching tier:', dbError)
        }
        if (data?.tier) {
          setTier(data.tier as UserTier)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchTier()
  }, [])

  return (
    <UserContext.Provider value={{ tier, loading }}>
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
