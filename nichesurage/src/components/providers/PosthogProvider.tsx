'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { captureClient, identifyClient, initPosthog, resetPosthog } from '@/lib/analytics/posthog-client'

// Hand-rolled provider:
//   - inits PostHog once on mount
//   - fires $pageview on every App Router navigation
//   - identifies the supabase user (id only — no email)
//   - resets on logout
export function PosthogProvider() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastUserId = useRef<string | null>(null)

  useEffect(() => {
    initPosthog()
  }, [])

  useEffect(() => {
    if (!pathname) return
    const search = searchParams?.toString()
    const url = search ? `${pathname}?${search}` : pathname
    captureClient('$pageview', { $current_url: url })
  }, [pathname, searchParams])

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!mounted) return
      if (user?.id) {
        identifyClient(user.id)
        lastUserId.current = user.id
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user.id) {
        if (lastUserId.current !== session.user.id) {
          identifyClient(session.user.id)
          lastUserId.current = session.user.id
        }
      } else if (event === 'SIGNED_OUT') {
        resetPosthog()
        lastUserId.current = null
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return null
}
