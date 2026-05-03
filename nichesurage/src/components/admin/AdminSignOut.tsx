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
      className="rounded-md border border-slate-800/60 px-3 py-1 text-xs text-slate-300 hover:border-slate-700 hover:text-slate-100"
    >
      Sign out
    </button>
  )
}
