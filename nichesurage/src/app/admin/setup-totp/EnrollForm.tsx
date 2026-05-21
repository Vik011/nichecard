'use client'

import { useFormState } from 'react-dom'
import { enrollTotp, type EnrollState } from './actions'

interface EnrollFormProps {
  secret: string
  qrDataUrl: string
  otpAuthUrl: string
}

const INITIAL: EnrollState = { status: 'idle' }

const ERROR_TEXT: Record<Exclude<EnrollState, { status: 'idle' } | { status: 'success' }>['error'], string> = {
  invalid_code: 'That code is not valid. Generate a fresh one from your authenticator and try again.',
  already_enrolled: 'You are already enrolled. Use the break-glass procedure to re-enroll.',
  not_admin: 'Admin gate refused. Sign in again.',
  persist_failed: 'Could not persist enrollment. Check Supabase logs.',
}

export function EnrollForm({ secret, qrDataUrl, otpAuthUrl }: EnrollFormProps) {
  const [state, formAction] = useFormState(enrollTotp, INITIAL)

  if (state.status === 'success') {
    return (
      <section className="space-y-5">
        <h2 className="text-lg font-semibold text-ink">Enrollment complete</h2>
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-ink">
          <p className="font-semibold">Save these 10 backup codes EXACTLY ONCE.</p>
          <p className="mt-1 text-ink-muted">
            They will not be shown again. Store them in Bitwarden as &quot;SurgeNiche / Admin Backup Codes&quot;. Each
            code is single-use, keep them until you need to recover access without your authenticator app.
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm text-ink">
          {state.plaintextCodes.map((c) => (
            <li key={c} className="rounded border border-hairline-edge/60 bg-canvas/60 px-3 py-2">
              {c}
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-muted">
          After you have saved these, navigate away. Refreshing this page will not re-show the codes.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <h2 className="text-lg font-semibold text-ink">Step 1: scan QR with your authenticator</h2>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <img
          src={qrDataUrl}
          alt="TOTP QR code"
          width={220}
          height={220}
          className="rounded-md border border-hairline-edge bg-white p-2"
        />
        <div className="text-sm text-ink-muted">
          <p>Or enter this secret manually:</p>
          <code className="mt-2 block break-all rounded border border-hairline-edge/60 bg-canvas/60 px-2 py-1 font-mono text-xs text-ink">
            {secret}
          </code>
          <p className="mt-3 text-xs">
            otpauth URL:{' '}
            <code className="break-all text-ink">{otpAuthUrl}</code>
          </p>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-ink">Step 2: confirm with the 6-digit code</h2>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="secret" value={secret} />
        <input
          name="token"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="one-time-code"
          required
          placeholder="123456"
          className="w-40 rounded-md border border-hairline-edge bg-canvas px-3 py-2 font-mono text-lg text-ink focus:border-accent-emerald-bright focus:outline-none"
        />
        <button
          type="submit"
          className="ml-3 rounded-md bg-accent-emerald-bright px-4 py-2 text-sm font-medium text-canvas hover:opacity-90"
        >
          Enroll
        </button>
      </form>

      {state.status === 'error' && (
        <p className="text-sm text-red-500" role="alert">
          {ERROR_TEXT[state.error]}
        </p>
      )}
    </section>
  )
}
