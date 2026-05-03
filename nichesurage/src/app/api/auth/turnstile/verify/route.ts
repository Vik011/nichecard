import { NextResponse } from 'next/server'
import { verifyTurnstileToken } from '@/lib/turnstile/verify'

export const runtime = 'nodejs'

/**
 * Login bot-defense gate. The /login page renders a Cloudflare Turnstile
 * widget; before we let the browser hand off to Google OAuth, the client
 * POSTs `{ token }` here. We confirm with Cloudflare's siteverify API and
 * return 403 if the challenge wasn't actually solved (bot, replay, etc.).
 *
 * Returns 200 `{ ok: true }` on pass.
 */
export async function POST(req: Request) {
  let payload: { token?: unknown } = {}
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 })
  }

  const token = payload.token
  if (typeof token !== 'string' || token.length === 0) {
    return NextResponse.json({ ok: false, error: 'missing-token' }, { status: 400 })
  }

  // Best-effort caller IP for Turnstile's rate-limit signal. Vercel/Cloudflare
  // both populate x-forwarded-for. We only take the first hop (closest to user).
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined

  const result = await verifyTurnstileToken(token, ip)
  if (!result.success) {
    return NextResponse.json({ ok: false, errorCodes: result.errorCodes }, { status: 403 })
  }
  return NextResponse.json({ ok: true })
}
