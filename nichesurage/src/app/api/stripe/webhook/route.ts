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

// Postgres unique-violation. Means the webhook event_id was already inserted —
// a previous delivery already processed (or is processing) this event.
const PG_UNIQUE_VIOLATION = '23505'

type SupabaseLike = ReturnType<typeof createServiceClient>

/**
 * Run the actual side-effects for a Stripe event. Pulled out so the route
 * handler can wrap it in idempotency + error tracking. Throws on real failures
 * so the caller can record the error and ask Stripe to retry.
 */
async function processEvent(event: Stripe.Event, supabase: SupabaseLike): Promise<void> {
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
        return
      }
      if (!mapped) {
        console.error('[stripe/webhook] could not map priceId', priceId)
        return
      }
      const periodEnd = item?.current_period_end
      const { error } = await supabase.from('users').update({
        tier: mapped.tier,
        billing_interval: mapped.interval,
        subscription_status: normalizeStatus(sub.status) ?? 'active',
        stripe_subscription_id: sub.id,
        subscription_current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      }).eq('id', userId)
      if (error) {
        console.error('[stripe/webhook] users update failed:', error)
        throw new Error(`users update failed: ${error.message}`)
      }
      console.log('[stripe/webhook] users updated to', mapped.tier, 'for user', userId)
      if (event.type === 'customer.subscription.created') {
        await captureServer({
          distinctId: userId,
          event: 'subscription_started',
          properties: { tier: mapped.tier, interval: mapped.interval, status: sub.status },
        })
      }
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id
      if (!userId) return
      const { error } = await supabase.from('users').update({
        tier: 'free',
        billing_interval: null,
        subscription_status: 'canceled',
        stripe_subscription_id: null,
      }).eq('id', userId)
      if (error) {
        console.error('[stripe/webhook] users downgrade failed:', error)
        throw new Error(`users downgrade failed: ${error.message}`)
      }
      await captureServer({
        distinctId: userId,
        event: 'subscription_canceled',
      })
      break
    }
  }
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

  // Idempotency gate: try to claim this event_id by inserting a row. If the
  // INSERT conflicts on the PK, another delivery already handled (or is
  // handling) it — ack 200 so Stripe stops retrying.
  const { error: insertErr } = await supabase
    .from('stripe_webhook_events')
    .insert({ event_id: event.id, event_type: event.type })

  if (insertErr) {
    if (insertErr.code === PG_UNIQUE_VIOLATION) {
      console.log('[stripe/webhook] duplicate event, skipping:', event.id)
      return NextResponse.json({ received: true, duplicate: true })
    }
    // Couldn't even record the event — return 500 so Stripe retries later.
    console.error('[stripe/webhook] failed to record event:', insertErr)
    return NextResponse.json({ error: 'db error' }, { status: 500 })
  }

  // We own this event. Run the handler; on success mark processed_at. On
  // failure DELETE the claim row so Stripe's retry isn't blocked by the
  // idempotency gate — a transient error (e.g. Supabase blip) should not
  // permanently wedge the event. Stripe bounds retries to ~3 days, and
  // permanent failures will surface in Sentry.
  try {
    await processEvent(event, supabase)
    await supabase
      .from('stripe_webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('event_id', event.id)
    return NextResponse.json({ received: true })
  } catch (err) {
    const msg = (err as Error).message ?? String(err)
    console.error('[stripe/webhook] processing failed:', msg)
    await supabase
      .from('stripe_webhook_events')
      .delete()
      .eq('event_id', event.id)
    return NextResponse.json({ error: 'processing failed' }, { status: 500 })
  }
}
