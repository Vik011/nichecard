import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { resolvePriceId, isValidTier, isValidInterval } from '@/lib/stripe/prices'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const tier = body?.tier
  const interval = body?.interval
  if (!isValidTier(tier)) return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  if (!isValidInterval(interval)) return NextResponse.json({ error: 'Invalid interval' }, { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  let customerId = profile?.stripe_customer_id ?? null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await supabase.from('users').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  const priceId = resolvePriceId(tier, interval)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${appUrl}/dashboard?upgraded=${tier}`,
    cancel_url: `${appUrl}/?canceled=1#pricing`,
    subscription_data: {
      metadata: { supabase_user_id: user.id, tier, interval },
    },
  })

  return NextResponse.json({ url: session.url })
}
