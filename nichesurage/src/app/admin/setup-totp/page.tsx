import QRCode from 'qrcode'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { generateSecret, generateOtpAuthUrl } from '@/lib/admin/totp'
import { EnrollForm } from './EnrollForm'

// Always SSR fresh; the secret must NOT be cached or shared between users.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SetupTotpPage() {
  const user = await requireAdmin()
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('admin_totp_secrets')
    .select('admin_email, created_at')
    .eq('admin_email', user.email)
    .maybeSingle()

  if (existing) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold text-ink">TOTP enrollment</h1>
        <div className="rounded-md border border-hairline-edge bg-canvas/60 p-5 text-sm text-ink">
          <p className="font-semibold">Already enrolled.</p>
          <p className="mt-2 text-ink-muted">
            Enrolled at <code className="font-mono text-ink">{existing.created_at}</code>.
          </p>
          <p className="mt-4 text-ink-muted">
            Break-glass procedure (lost authenticator + no backup codes left):
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-muted">
            <li>Open Supabase SQL editor for project <code>qwedflkklenqbijheasx</code>.</li>
            <li>
              Run{' '}
              <code className="font-mono text-ink">
                DELETE FROM admin_totp_secrets WHERE admin_email = &apos;{user.email}&apos;;
              </code>
            </li>
            <li>
              Run{' '}
              <code className="font-mono text-ink">
                DELETE FROM admin_totp_backup_codes WHERE admin_email = &apos;{user.email}&apos;;
              </code>
            </li>
            <li>Refresh this page to re-enroll.</li>
          </ol>
        </div>
      </div>
    )
  }

  // Not enrolled: generate a fresh secret for this render. The secret lives
  // in the rendered HTML (hidden form field) and gets persisted ONLY after
  // the admin confirms with a valid 6-digit code from their authenticator.
  // If they navigate away without confirming, the secret is just discarded.
  const secret = generateSecret()
  const otpAuthUrl = generateOtpAuthUrl(user.email!, secret)
  const qrDataUrl = await QRCode.toDataURL(otpAuthUrl, { margin: 1, width: 220 })

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-ink">TOTP enrollment</h1>
      <p className="text-sm text-ink-muted">
        Set up time-based one-time passwords (TOTP) for your admin account. After enrollment,
        destructive actions require a 6-digit code from your authenticator app within a 5-minute
        sudo window.
      </p>
      <EnrollForm secret={secret} qrDataUrl={qrDataUrl} otpAuthUrl={otpAuthUrl} />
    </div>
  )
}
