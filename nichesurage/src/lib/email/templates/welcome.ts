// Welcome email sent on a user's first successful Google OAuth sign-in.
//
// We hand-roll the HTML rather than pulling in `@react-email/components` so
// the email pipeline stays one tiny dependency (`resend`) and the markup
// renders identically across Gmail, Outlook, Apple Mail. The trade-off: any
// styling change is a string edit instead of JSX. Acceptable while we have a
// single transactional template.
//
// Tone notes (per user 2026-05-04):
//   * No em-dashes or en-dashes anywhere; use commas, colons, periods.
//   * Concise: subject line + 3 short blocks + CTA + sign-off.
//   * Brand voice "SurgeNiche" rather than founder-personal.

export const WELCOME_SUBJECT = 'Welcome to SurgeNiche'

export interface WelcomeTemplateInput {
  /** Parsed first name; null falls back to "Hi there,". */
  firstName: string | null
}

// CTA points to /discover (the live niches feed). The /trending route was
// part of Sprint B Phase 7B but is paused while the trend engine bootstraps,
// so linking there from email would 404 for new users.
const DISCOVER_URL = 'https://surgeniche.com/discover'

/**
 * Returns ready-to-send HTML for the welcome email.
 *
 * The template uses inline styles only because most email clients (Gmail,
 * Outlook web, iOS Mail) strip <style> blocks or apply their own resets.
 */
export function renderWelcomeEmail({ firstName }: WelcomeTemplateInput): string {
  const greetingName = firstName?.trim() ? escapeHtml(firstName.trim()) : 'there'
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Welcome to SurgeNiche</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;padding:40px 36px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            <tr>
              <td>
                <p style="margin:0 0 24px 0;font-size:18px;line-height:1.5;color:#1a1a1a;">
                  Hi ${greetingName},
                </p>
                <p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;color:#1a1a1a;">
                  Welcome to SurgeNiche.
                </p>
                <p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;color:#1a1a1a;">
                  Most YouTube tools show you yesterday's winners. We track today's wave: niches exploding right now, spotted by detecting when the same topic gets replicated across multiple creators in real time.
                </p>
                <p style="margin:0 0 28px 0;font-size:16px;line-height:1.6;color:#1a1a1a;">
                  Your first stop: open the app and see what we're surfacing right now. New niches land hourly.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 32px 0;">
                  <tr>
                    <td style="border-radius:8px;background-color:#1a1a1a;">
                      <a href="${DISCOVER_URL}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                        Open SurgeNiche
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 4px 0;font-size:15px;line-height:1.5;color:#1a1a1a;">
                  Cheers,
                </p>
                <p style="margin:0;font-size:15px;line-height:1.5;color:#1a1a1a;">
                  SurgeNiche
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0 0;font-size:12px;line-height:1.5;color:#888888;text-align:center;">
            You're receiving this because you signed up at <a href="https://surgeniche.com" style="color:#888888;">surgeniche.com</a>.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** Minimal HTML escape for the dynamic name field (defense against weird Google profile names). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
