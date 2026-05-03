// Server-side Cloudflare Turnstile verification.
//
// Flow: client renders the Turnstile widget on /login. When it solves, it gets
// a one-time token (`cf-turnstile-response`). Before we kick off OAuth, the
// client POSTs the token to /api/auth/turnstile/verify; that route calls this
// helper to confirm with Cloudflare that the token is real, unspent, and
// originated from one of our allowed hostnames.
//
// Secret key is never exposed to the browser — only the public site key is.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export interface TurnstileVerifyResult {
  success: boolean
  /** Cloudflare-supplied error codes, useful for ops debugging. */
  errorCodes: string[]
}

/**
 * Verify a Turnstile response token with Cloudflare. Returns success=false
 * (rather than throwing) for any failure mode so callers can uniformly
 * 403 the request.
 */
export async function verifyTurnstileToken(
  token: string,
  ip?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileVerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    // Fail closed in production. In dev (no secret) this would be a footgun,
    // so we explicitly opt the dev fallback in via TURNSTILE_DEV_BYPASS=1.
    if (process.env.TURNSTILE_DEV_BYPASS === '1') {
      return { success: true, errorCodes: ['dev-bypass'] }
    }
    console.error('[turnstile] TURNSTILE_SECRET_KEY not set')
    return { success: false, errorCodes: ['missing-secret'] }
  }
  if (!token) {
    return { success: false, errorCodes: ['missing-input-response'] }
  }

  const body = new URLSearchParams()
  body.append('secret', secret)
  body.append('response', token)
  if (ip) body.append('remoteip', ip)

  try {
    const res = await fetchImpl(VERIFY_URL, {
      method: 'POST',
      body,
    })
    const json = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
    return {
      success: !!json.success,
      errorCodes: json['error-codes'] ?? [],
    }
  } catch (err) {
    console.error('[turnstile] verify request failed:', err)
    return { success: false, errorCodes: ['network-error'] }
  }
}
