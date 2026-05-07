import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendWelcomeEmail } from '@/lib/email/resend'
import { getDailyDemoNiche } from '@/lib/tier/freeDemo'
import { preWarmDemoNiche } from '@/lib/demo/preWarm'

export const runtime = 'nodejs'

type SupabaseServerClient = ReturnType<typeof createClient>

const VALID_PLANS = new Set(['basic', 'premium'])
const VALID_INTERVALS = new Set(['monthly', 'yearly'])

// First-login WOW demo cookie. Set when the auth callback redirects a brand
// new free user to the demo niche detail page. The detail page reads this
// cookie to validate that ?freeDemo=true is legitimately ours and not a
// hand-crafted URL someone pasted around.
const DEMO_COOKIE = 'surgeniche_demo_seen'
const DEMO_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 // 24h is enough to span the user's first session

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

  // First-login WOW demo: brand new free user → single fully-unlocked niche
  // detail page instead of /discover (where most cards are locked). Per
  // product decision 2026-05-07, the demo niche is GLOBAL DETERMINISTIC —
  // every free user signing up on the same UTC day sees the same niche.
  // See `getDailyDemoNiche` for the read-then-write pin pattern.
  //
  // We always set `first_login_at` (even when no demo niche could be
  // picked) so a single user only ever traverses this branch once — the
  // demo is a one-shot experience, not a re-entrant flow.
  const demoRedirect = await maybeFirstLoginDemo(supabase, appUrl).catch((err) => {
    console.error('[auth/callback] first-login demo branch threw', err)
    return null
  })
  if (demoRedirect) return demoRedirect

  // Default landing after sign-in: discover feed (longform, defaults to
  // 'quality' mode while the trend engine is bootstrapping). Previously this
  // redirected to /dashboard which renders the user's empty Saved Niches
  // list, a catastrophic first impression for new free users.
  return NextResponse.redirect(new URL('/discover?type=longform', appUrl))
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

/**
 * Brand-new free user branch. Returns a redirect to the demo niche detail
 * when this is the user's very first authenticated visit, or null when:
 *   * user has logged in before (first_login_at already set)
 *   * user row not yet upserted (rare race, fall through to /discover)
 *   * no candidate niche to pin today (cold start)
 *
 * Always sets `first_login_at` on the way through so the branch is
 * one-shot per user even when no demo niche is available.
 */
async function maybeFirstLoginDemo(
  supabase: SupabaseServerClient,
  appUrl: string,
): Promise<NextResponse | null> {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user
  if (!user) return null

  const { data: profile, error: profileErr } = await supabase
    .from('users')
    .select('first_login_at, tier')
    .eq('id', user.id)
    .maybeSingle()
  if (profileErr) {
    console.error('[auth/callback] first_login read failed', profileErr)
    return null
  }
  if (!profile) return null // handle_new_user trigger not yet fired
  if (profile.first_login_at) return null // returning user, not a first-time demo candidate

  // Pinning the day's demo niche needs to bypass RLS (anon SELECT is fine
  // but only service-role can INSERT into daily_demo_niche).
  const service = createServiceClient()
  const demo = await getDailyDemoNiche(service)

  // Mark first-login regardless of demo availability so we never re-enter
  // this branch for the same user. Service client bypasses RLS so the
  // update succeeds even if the user row's RLS would normally block writes.
  const { error: updErr } = await service
    .from('users')
    .update({ first_login_at: new Date().toISOString() })
    .eq('id', user.id)
  if (updErr) {
    console.error('[auth/callback] failed to set first_login_at', updErr)
    // Continue anyway — worst case the user re-enters this branch on the
    // very next login, which still produces a valid (if redundant) demo.
  }

  if (!demo) return null // cold start: no candidate niche, fall through to /discover

  // Sprint A.9 Phase B: only the first sign-in of the day pays the AI
  // pre-warm cost — Anthropic for the verdict + Anthropic for content
  // angles. Every subsequent demo viewer reads from the populated cache.
  // We fire-and-forget so the user's redirect doesn't sit on the AI
  // round-trip (~2-3s). Worst case: race between user's first paint and
  // the warm finishing → API route serves "warming up" 503 → frontend
  // retries → second-paint succeeds.
  if (demo.justInserted) {
    preWarmDemoNiche(demo.scanResultId).catch((err) => {
      console.error('[auth/callback] preWarm threw', err)
    })
  }

  // Sprint A.9: demo niche now opens as a modal over /discover (so it
  // doesn't claim the whole screen and the user can dismiss it back to
  // the live grid in one click). The modal reads `?niche=<id>` to
  // determine which niche to load and `?freeDemo=true` to render the
  // welcome banner. The standalone /discover/niche/<id> page route still
  // exists for direct URL access (bookmarks, link shares).
  const target = new URL(`/discover`, appUrl)
  target.searchParams.set('niche', demo.scanResultId)
  target.searchParams.set('freeDemo', 'true')

  // Cookie tells the niche detail page that this `freeDemo=true` request
  // is legitimate (server-issued) and not a hand-crafted URL. Detail page
  // double-checks scan_result_id against today's daily_demo_niche row.
  const response = NextResponse.redirect(target)
  response.cookies.set(DEMO_COOKIE, '1', {
    httpOnly: false, // client reads it for analytics later, no secrets in value
    sameSite: 'lax',
    secure: appUrl.startsWith('https://'),
    path: '/',
    maxAge: DEMO_COOKIE_MAX_AGE_SECONDS,
  })
  return response
}
