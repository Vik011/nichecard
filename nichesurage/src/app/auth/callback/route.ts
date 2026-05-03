import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

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
