import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { tierFromPriceId } from '@/lib/stripe/prices'
import { createServiceClient } from '@/lib/supabase/service'
import { captureServer } from '@/lib/analytics/posthog-server'
import type Stripe from 'stripe'
import type { SubscriptionStatus } from '@/lib/types/database'

export const runtime = 'nodejs'

const VALID_STATUSES: SubscriptionStatus[] = ['active', 'trialing', 'past_due', 'canceled', 'incomplete']

function normalizeStatus(s: string): SubscriptionStatus | null {
  return (VALID_STATUSES as string[]).includes(s) ? (s as SubscriptionStatus) : null
}

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !secret) return NextResponse.json({ error: 'missing sig' }, { status: 400 })

  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret)
  } catch (err) {
    return NextResponse.json({ error: `bad signature: ${(err as Error).message}` }, { status: 400 })
  }

  const supabase = createServiceClient()

  console.log('[stripe/webhook] received event:', event.type, event.id)

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const item = sub.items.data[0]
      const priceId = item?.price.id
      const mapped = priceId ? tierFromPriceId(priceId) : null
      const userId = sub.metadata?.supabase_user_id
      console.log('[stripe/webhook] sub update:', { subId: sub.id, userId, priceId, mapped })
      if (!userId) {
        console.error('[stripe/webhook] no supabase_user_id in metadata')
      } else if (!mapped) {
        console.error('[stripe/webhook] could not map priceId', priceId)
      } else {
        const periodEnd = item?.current_period_end
        const { error } = await supabase.from('users').update({
          tier: mapped.tier,
          billing_interval: mapped.interval,
          subscription_status: normalizeStatus(sub.status) ?? 'active',
          stripe_subscription_id: sub.id,
          subscription_current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        }).eq('id', userId)
        if (error) console.error('[stripe/webhook] users update failed:', error)
        else console.log('[stripe/webhook] users updated to', mapped.tier, 'for user', userId)
        if (event.type === 'customer.subscription.created') {
          await captureServer({
            distinctId: userId,
            event: 'subscription_started',
            properties: { tier: mapped.tier, interval: mapped.interval, status: sub.status },
          })
        }
      }
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id
      if (userId) {
        const { error } = await supabase.from('users').update({
          tier: 'free',
          billing_interval: null,
          subscription_status: 'canceled',
          stripe_subscription_id: null,
        }).eq('id', userId)
        if (error) console.error('[stripe/webhook] users downgrade failed:', error)
        await captureServer({
          distinctId: userId,
          event: 'subscription_canceled',
        })
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
