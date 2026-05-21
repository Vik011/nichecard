'use server'

import { requireAdmin } from '@/lib/admin/auth'
import { verifyToken, encryptSecret } from '@/lib/admin/totp'
import { generateCodes, hashCode } from '@/lib/admin/backupCodes'
import { createServiceClient } from '@/lib/supabase/service'

export type EnrollState =
  | { status: 'idle' }
  | { status: 'success'; plaintextCodes: string[] }
  | { status: 'error'; error: 'invalid_code' | 'already_enrolled' | 'not_admin' | 'persist_failed' }

/**
 * One-time TOTP enrollment Server Action. Called by EnrollForm via
 * useFormState. Re-asserts admin (defense — the page already gates,
 * but Server Actions can be invoked independently of page render).
 *
 * Flow:
 *   1. requireAdmin (notFound() if not) -> wrap in try/catch to return
 *      a structured error rather than letting Next swallow it.
 *   2. Idempotency check: if admin_totp_secrets already has a row for
 *      this admin, reject with 'already_enrolled'. Re-enroll is a
 *      break-glass SQL DELETE then re-run, NOT an in-app flow.
 *   3. Verify the submitted 6-digit token against the in-memory secret
 *      that the page rendered (passed back via hidden form field).
 *   4. Encrypt the secret + generate + hash 10 backup codes.
 *   5. Persist secret row + 10 backup code rows. If any insert errors,
 *      bail with 'persist_failed' (a partial enroll is detectable in
 *      the DB and break-glass-able).
 *   6. Return plaintext codes so the client renders them ONCE.
 */
export async function enrollTotp(_prev: EnrollState, formData: FormData): Promise<EnrollState> {
  let adminEmail: string
  try {
    const user = await requireAdmin()
    if (!user.email) return { status: 'error', error: 'not_admin' }
    adminEmail = user.email
  } catch {
    return { status: 'error', error: 'not_admin' }
  }

  const secret = formData.get('secret')
  const token = formData.get('token')
  if (typeof secret !== 'string' || !secret || typeof token !== 'string' || !token) {
    return { status: 'error', error: 'invalid_code' }
  }

  const supabase = createServiceClient()

  // Idempotency / double-enroll guard
  const { data: existing } = await supabase
    .from('admin_totp_secrets')
    .select('admin_email')
    .eq('admin_email', adminEmail)
    .maybeSingle()
  if (existing) return { status: 'error', error: 'already_enrolled' }

  if (!verifyToken(token, secret)) {
    return { status: 'error', error: 'invalid_code' }
  }

  const encrypted = encryptSecret(secret)
  const plaintextCodes = generateCodes(10)
  const hashedCodes = await Promise.all(plaintextCodes.map(hashCode))

  const { error: secretErr } = await supabase
    .from('admin_totp_secrets')
    .insert({ admin_email: adminEmail, encrypted_secret: encrypted })
  if (secretErr) {
    console.error('[setup-totp] secret insert failed', secretErr)
    return { status: 'error', error: 'persist_failed' }
  }

  // Insert each backup code row. Sequential is fine — 10 rows.
  for (let i = 0; i < plaintextCodes.length; i++) {
    const { error } = await supabase
      .from('admin_totp_backup_codes')
      .insert({ admin_email: adminEmail, code_hash: hashedCodes[i] })
    if (error) {
      console.error('[setup-totp] backup code insert failed', error)
      return { status: 'error', error: 'persist_failed' }
    }
  }

  return { status: 'success', plaintextCodes }
}
