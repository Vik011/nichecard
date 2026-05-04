import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/email/resend'

export const runtime = 'nodejs'

type SupabaseServerClient = ReturnType<typeof createClient>

const VALID_PLANS = new Set(['basic', 'premium'])
const VALID_INTERVALS = new Set(['monthly', 'yearly'])

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const rawPlan = url.searchParams.get('plan')
  const rawBilling = url.searchParams.get('billing')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', appUrl))
  }

  const supabase = createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, appUrl))
  }

  // First-login welcome email; never blocks the redirect on failure. We await
  // (rather than fire-and-forget) because Vercel may freeze the serverless
  // function once the response is returned, killing in-flight requests.
  await maybeSendWelcome(supabase).catch((err) => {
    console.error('[auth/callback] welcome email handler threw', err)
  })

  const plan = rawPlan && VALID_PLANS.has(rawPlan) ? rawPlan : null
  const billing = rawBilling && VALID_INTERVALS.has(rawBilling) ? rawBilling : null

  if (plan && billing) {
    const checkoutResp = await fetch(`${appUrl}/api/stripe/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({ tier: plan, interval: billing }),
    })
    if (checkoutResp.ok) {
      const data = await checkoutResp.json()
      if (data?.url) return NextResponse.redirect(data.url)
    }
  }

  return NextResponse.redirect(new URL('/dashboard', appUrl))
}

/**
 * Sends the welcome email if the user has never received one. Failure modes
 * (DB error, Resend down, missing API key) all leave `welcome_email_sent_at`
 * NULL so the next sign-in retries silently. Never throws.
 */
async function maybeSendWelcome(supabase: SupabaseServerClient): Promise<void> {
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) return

  const user = userData.user
  if (!user.email) return

  const { data: profile, error: profileErr } = await supabase
    .from('users')
    .select('welcome_email_sent_at')
    .eq('id', user.id)
    .maybeSingle()

  if (profileErr) {
    console.error('[auth/callback] failed to read welcome flag', profileErr)
    return
  }
  if (profile?.welcome_email_sent_at) return // already sent on a previous login

  const fullName = (user.user_metadata?.full_name as string | undefined) ?? null
  const firstName = parseFirstName(fullName)

  const result = await sendWelcomeEmail({ to: user.email, firstName })
  if (!result.ok) {
    console.warn('[auth/callback] welcome email send failed; will retry next login', result.error)
    return
  }

  const { error: updErr } = await supabase
    .from('users')
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq('id', user.id)

  if (updErr) {
    // Email was delivered but flag write failed; user may get a duplicate next login. Acceptable.
    console.error('[auth/callback] failed to set welcome flag after send', updErr)
  }
}

/** Pulls "Vik" out of "Vik Martin" / "Viktor Martin Petrović"; null when blank. */
function parseFirstName(fullName: string | null): string | null {
  if (!fullName) return null
  const first = fullName.trim().split(/\s+/)[0]
  return first || null
}
