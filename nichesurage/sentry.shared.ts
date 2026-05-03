// Shared Sentry scrubbing logic — applied via beforeSend in all three
// runtime configs (client, server, edge) so a sensitive value can't sneak
// through one runtime that wasn't configured.
//
// What we strip:
//   - `authorization` / `cookie` / `x-stripe-signature` request headers
//   - URL query params containing the substrings: token, key, secret, password, jwt
//   - Same scrub in breadcrumb URLs (Sentry's "page navigated to" trail)
//
// We do NOT strip the URL path — the path itself (e.g. `/api/stripe/webhook`)
// is operationally useful for debugging and contains no secrets.

const SENSITIVE_QUERY_KEYS = ['token', 'key', 'secret', 'password', 'jwt', 'access_token', 'refresh_token']

function scrubUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return rawUrl
  try {
    const u = new URL(rawUrl, 'https://placeholder.local')
    let modified = false
    for (const key of [...u.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.some(s => key.toLowerCase().includes(s))) {
        u.searchParams.set(key, '[redacted]')
        modified = true
      }
    }
    if (!modified) return rawUrl
    // Re-emit relative if we got a relative input.
    if (rawUrl.startsWith('http')) return u.toString()
    return u.pathname + (u.search ? u.search : '')
  } catch {
    return rawUrl
  }
}

// deno-lint-ignore no-explicit-any
export function scrubSentryEvent(event: any): any {
  // Headers — strip auth/cookie/stripe-signature.
  if (event?.request?.headers) {
    delete event.request.headers['authorization']
    delete event.request.headers['Authorization']
    delete event.request.headers['cookie']
    delete event.request.headers['Cookie']
    delete event.request.headers['x-stripe-signature']
    delete event.request.headers['Stripe-Signature']
  }

  // Request URL — scrub sensitive query params.
  if (event?.request?.url) {
    event.request.url = scrubUrl(event.request.url)
  }

  // Breadcrumbs — Sentry records every navigation/fetch as a breadcrumb
  // with a `data.url` field. Same scrub applies.
  if (Array.isArray(event?.breadcrumbs)) {
    for (const bc of event.breadcrumbs) {
      if (bc?.data?.url) bc.data.url = scrubUrl(bc.data.url)
      // Some HTTP integrations put it under `data.to`.
      if (bc?.data?.to) bc.data.to = scrubUrl(bc.data.to)
    }
  }

  return event
}
