import { Resend } from 'resend'

import { renderWelcomeEmail, WELCOME_SUBJECT } from './templates/welcome'

// ─── Resend client ───────────────────────────────────────────────────────
//
// Single shared client instance per serverless invocation. Resend's SDK is
// lightweight (just an HTTP client around api.resend.com) so this is fine.
//
// `RESEND_API_KEY` is required in Production + Preview environments. Local
// dev (`vercel dev`, no env) skips the send (see `sendWelcomeEmail`).

const apiKey = process.env.RESEND_API_KEY
const client = apiKey ? new Resend(apiKey) : null

const FROM = 'SurgeNiche <noreply@send.surgeniche.com>'
const REPLY_TO = 'vikmartin.online@gmail.com'

export interface WelcomeEmailInput {
  /** Recipient address (typically auth.users.email). */
  to: string
  /** First name parsed from Google OAuth `full_name`; null falls back to "Hi there,". */
  firstName: string | null
}

export interface SendResult {
  ok: boolean
  /** Resend message id when ok=true. */
  id?: string
  /** Error string when ok=false. Caller decides whether to retry. */
  error?: string
}

/**
 * Sends the SurgeNiche welcome email to a single recipient.
 *
 * Returns `{ ok: false }` (never throws) so callers in the auth callback can
 * decide to leave `welcome_email_sent_at` NULL for a retry on the next login.
 *
 * No-op when `RESEND_API_KEY` is unset (local dev without the secret); returns
 * `{ ok: false, error: 'no_api_key' }` so the flag stays NULL.
 */
export async function sendWelcomeEmail({ to, firstName }: WelcomeEmailInput): Promise<SendResult> {
  if (!client) {
    return { ok: false, error: 'no_api_key' }
  }

  try {
    const { data, error } = await client.emails.send({
      from: FROM,
      to,
      replyTo: REPLY_TO,
      subject: WELCOME_SUBJECT,
      html: renderWelcomeEmail({ firstName }),
    })

    if (error) {
      return { ok: false, error: error.message ?? 'resend_unknown_error' }
    }
    return { ok: true, id: data?.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'resend_throw' }
  }
}
