import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

/**
 * Admin gate.
 *
 * Auth is regular Google OAuth — admins are normal users whose email appears
 * in the `ADMIN_EMAILS` env var (comma-separated). Everything else is the
 * same auth flow normal users go through.
 *
 * On non-admin access we throw `notFound()` (404) rather than redirect, so
 * the existence of /admin isn't leaked to logged-in non-admins or scanners.
 */

/** Returns true if the email is in the admin allow-list. Case-insensitive. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const allow = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allow.includes(email.toLowerCase())
}

/**
 * Server-side guard for admin pages. Call at the top of any RSC under
 * /admin. Returns the authenticated admin user. On non-admin access this
 * throws via Next's `notFound()` — page renders the standard 404, never
 * "you are not authorized" (which would confirm /admin exists).
 */
export async function requireAdmin() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    notFound()
  }
  return user
}
