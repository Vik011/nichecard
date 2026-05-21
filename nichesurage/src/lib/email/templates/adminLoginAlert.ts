// Security self-monitoring email sent on every admin sign-in. The recipient
// is the admin themselves (self-monitoring per design spec). If the admin
// gets an email they didn't trigger, that's the signal to investigate.
//
// Same hand-rolled HTML / inline-styles approach as welcome.ts — keeps the
// email pipeline at one tiny dep (resend) and renders identically across
// Gmail / Outlook / Apple Mail.

export const ADMIN_LOGIN_ALERT_SUBJECT = 'SurgeNiche Admin: sign-in detected'

export interface AdminLoginAlertTemplateInput {
  /** ISO-8601 timestamp of the sign-in. */
  ts: string
  /** Client IP, parsed from x-forwarded-for. null if unavailable. */
  ip: string | null
  /** Raw user-agent string from the sign-in request. null if missing. */
  userAgent: string | null
}

export function renderAdminLoginAlertEmail({ ts, ip, userAgent }: AdminLoginAlertTemplateInput): string {
  const ipText = ip ? escapeHtml(ip) : 'unknown'
  const uaText = userAgent ? escapeHtml(userAgent) : 'unknown'
  const tsText = escapeHtml(ts)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SurgeNiche Admin sign-in</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.06);overflow:hidden;">
            <tr>
              <td style="background-color:#0d1220;padding:20px 32px;border-bottom:1px solid #1a2236;">
                <span style="font-size:16px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">SurgeNiche Admin</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px 0;font-size:16px;line-height:1.5;color:#1a1a1a;">
                  An admin sign-in was just recorded on your account.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;border-collapse:collapse;">
                  <tr>
                    <td style="padding:8px 0;font-size:13px;color:#666;width:120px;">Time (UTC)</td>
                    <td style="padding:8px 0;font-size:13px;color:#1a1a1a;font-family:monospace;">${tsText}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-size:13px;color:#666;">IP address</td>
                    <td style="padding:8px 0;font-size:13px;color:#1a1a1a;font-family:monospace;">${ipText}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-size:13px;color:#666;vertical-align:top;">User agent</td>
                    <td style="padding:8px 0;font-size:13px;color:#1a1a1a;font-family:monospace;word-break:break-all;">${uaText}</td>
                  </tr>
                </table>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;color:#1a1a1a;">
                  If this was you: no action required.
                </p>
                <p style="margin:0;font-size:14px;line-height:1.5;color:#b91c1c;">
                  If this was NOT you: rotate Supabase service-role key, revoke admin session in Supabase Dashboard, and re-enroll TOTP on /admin/setup-totp after break-glass.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0 0;font-size:11px;line-height:1.5;color:#888888;text-align:center;">
            Self-monitoring alert sent to your admin address.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** Minimal HTML escape; mirrors welcome.ts. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
