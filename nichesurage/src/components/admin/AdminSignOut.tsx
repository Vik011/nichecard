'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

/**
 * Sign-out button for the admin shell. Tiny client island; the rest of the
 * /admin tree is server-rendered.
 */
export function AdminSignOut() {
  const router = useRouter()
  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }
  return (
    <button
      type="button"
      onClick={signOut}
      className="rounded-md border border-hairline-edge/60 px-3 py-1 text-xs text-ink-muted hover:border-hairline-edge hover:text-ink"
    >
      Sign out
    </button>
  )
}
