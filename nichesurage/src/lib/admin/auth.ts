import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'

/**
 * Admin gate. Dual control:
 *   1. Email present in ADMIN_EMAILS env (isAdminEmail) — operator-controlled
 *      via Vercel.
 *   2. users.is_admin = true in the DB (assertAdminIsActive) — survives an
 *      env leak / config mistake and is what the RLS policies in 0054 key on.
 *
 * Both must pass. We notFound() on either failure — never redirect or 401,
 * to keep /admin invisible to scanners.
 */

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const allow = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allow.includes(email.toLowerCase())
}

/**
 * DB-side admin flag check. Fail-closed: returns false on any error (including
 * missing row) so a transient DB hiccup locks admin out rather than letting
 * a non-admin through.
 */
export async function assertAdminIsActive(userId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .single()
  if (error || !data) return false
  return Boolean((data as { is_admin: boolean }).is_admin)
}

export async function requireAdmin() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    notFound()
  }
  if (!(await assertAdminIsActive(user.id))) {
    notFound()
  }
  return user
}
