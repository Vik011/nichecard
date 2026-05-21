import crypto from 'crypto'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'

export const SUDO_COOKIE_NAME = 'admin_sudo'
export const SUDO_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Issue a fresh sudo grant: insert admin_sessions row with sudo_until = now+5min,
 * set an HttpOnly+Secure+SameSite=Strict cookie scoped to /admin holding the
 * session id. The DB is the truth source for sudo_until — the cookie is just
 * a session identifier.
 */
export async function issueSudo(adminEmail: string): Promise<void> {
  const supabase = createServiceClient()
  const sessionId = crypto.randomUUID()
  const sudoUntil = new Date(Date.now() + SUDO_TTL_MS).toISOString()
  const { error } = await supabase.from('admin_sessions').insert({
    id: sessionId,
    admin_email: adminEmail,
    sudo_until: sudoUntil,
  })
  if (error) throw new Error(`sudo issue failed: ${error.message}`)

  cookies().set(SUDO_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/admin',
    maxAge: SUDO_TTL_MS / 1000,
  })
}

/**
 * Check whether the caller has a live sudo grant for `adminEmail`. The cookie
 * gives us a session id; the DB tells us whether that session is still in its
 * 5-min window AND was issued to the same admin. Both must match.
 */
export async function verifySudo(adminEmail: string): Promise<{ valid: boolean; sudoVerifiedAt: string | null }> {
  const sessionId = cookies().get(SUDO_COOKIE_NAME)?.value
  if (!sessionId) return { valid: false, sudoVerifiedAt: null }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('admin_sessions')
    .select('admin_email, sudo_until')
    .eq('id', sessionId)
    .single()

  if (error || !data) return { valid: false, sudoVerifiedAt: null }
  if (data.admin_email !== adminEmail) return { valid: false, sudoVerifiedAt: null }
  if (!data.sudo_until) return { valid: false, sudoVerifiedAt: null }
  if (new Date(data.sudo_until as string) <= new Date()) return { valid: false, sudoVerifiedAt: null }

  return { valid: true, sudoVerifiedAt: data.sudo_until as string }
}

/**
 * Server-Action guard. Returns the sudo_verified_at timestamp (for audit log
 * inclusion). Throws if no live sudo — caller should let the throw propagate
 * to the form action so the UI knows to prompt for TOTP again.
 */
export async function requireSudo(adminEmail: string): Promise<string> {
  const { valid, sudoVerifiedAt } = await verifySudo(adminEmail)
  if (!valid || !sudoVerifiedAt) throw new Error('sudo required')
  return sudoVerifiedAt
}
