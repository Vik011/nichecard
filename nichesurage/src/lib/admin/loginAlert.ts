import * as Sentry from '@sentry/nextjs'
import { sendAdminLoginAlert } from '@/lib/email/resend'

export interface AdminLoginAlertInput {
  adminEmail: string
  ip: string | null
  userAgent: string | null
  /** ISO-8601 timestamp. Defaults to new Date().toISOString(). */
  ts?: string
}

/**
 * Self-monitoring alert fired from /auth/callback when an admin signs in.
 * Two independent paths so a single failure doesn't silence the alert:
 *   1. Sentry breadcrumb + captureMessage (shows up in the next captured
 *      event for context, plus an immediate info-level event)
 *   2. Resend email to the admin's own inbox
 *
 * Never throws — callers fire-and-forget via .catch().
 */
export async function fireAdminLoginAlert(input: AdminLoginAlertInput): Promise<void> {
  const ts = input.ts ?? new Date().toISOString()

  try {
    Sentry.addBreadcrumb({
      category: 'admin.auth',
      message: 'admin sign-in',
      level: 'info',
      data: { adminEmail: input.adminEmail, ip: input.ip, userAgent: input.userAgent, ts },
    })
    Sentry.captureMessage(`Admin signed in: ${input.adminEmail}`, 'info')
  } catch (err) {
    console.error('[loginAlert] Sentry path threw:', err)
  }

  try {
    const result = await sendAdminLoginAlert({
      to: input.adminEmail,
      ts,
      ip: input.ip,
      userAgent: input.userAgent,
    })
    if (!result.ok) {
      console.warn('[loginAlert] Resend send failed:', result.error)
    }
  } catch (err) {
    console.error('[loginAlert] Resend path threw:', err)
  }
}
