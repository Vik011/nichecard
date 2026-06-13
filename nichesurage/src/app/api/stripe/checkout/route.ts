import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe/client'
import { resolvePriceId, isValidTier, isValidInterval } from '@/lib/stripe/prices'
import { captureServer } from '@/lib/analytics/posthog-server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
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
      .maybeSingle()

    let customerId = profile?.stripe_customer_id ?? null
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      // stripe_customer_id is a billing-linkage field: migration 0066 freezes it
      // for the `authenticated` role (writing it as the user would allow pointing
      // one's row at another customer → billing-portal takeover). So this write
      // must go through service_role. Scoped to the caller's own row via .eq(id).
      const service = createServiceClient()
      const { error: updateError } = await service
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
      if (updateError) {
        console.error('[stripe/checkout] users update failed:', updateError)
        return NextResponse.json({ error: `users update failed: ${updateError.message}` }, { status: 500 })
      }
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
      // EU consumer-protection requirement (§ 356 (5) BGB / Art. 16(m) of EU
      // Directive 2011/83/EU): the 14-day right of withdrawal for digital
      // services is waived only with the customer's express prior consent.
      // We surface that waiver as a required Terms acceptance on the
      // hosted Checkout page so the consent is documented at the moment of
      // sale. Without this, an EU customer could request a full refund any
      // time within 14 days even though the AI features they triggered have
      // already cost us third-party API fees.
      consent_collection: { terms_of_service: 'required' },
      custom_text: {
        terms_of_service_acceptance: {
          message:
            "I have read and agree to SurgeNiche's [Terms of Service](https://surgeniche.com/terms) and [Privacy Policy](https://surgeniche.com/privacy). I expressly request that performance begin immediately and acknowledge that I lose my 14-day EU right of withdrawal once SurgeNiche starts running for me.",
        },
      },
    })

    await captureServer({
      distinctId: user.id,
      event: 'checkout_session_started',
      properties: { tier, interval },
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    const msg = (e as Error).message ?? 'Unknown error'
    console.error('[stripe/checkout] failed:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
