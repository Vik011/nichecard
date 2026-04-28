'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserTier } from '@/lib/types/database'

interface UserContextValue {
  tier: UserTier
  loading: boolean
}

const UserContext = createContext<UserContextValue>({ tier: 'free', loading: true })

export function UserProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<UserTier>('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function fetchTier() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return
        const { data } = await supabase
          .from('users')
          .select('tier')
          .eq('id', user.id)
          .single()
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

export function useUser() {
  return useContext(UserContext)
}
