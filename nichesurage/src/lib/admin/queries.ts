import { createServiceClient } from '@/lib/supabase/service'
import { computeMrrEur, type SubBreakdown } from './mrr'
import type { UserTier, BillingInterval, SubscriptionStatus } from '@/lib/types/database'
import type { PaidTier } from '@/lib/stripe/prices'

// All admin queries use the service-role client. RLS would block them
// otherwise (admin sees rows that belong to other users). The /admin gate
// (requireAdmin) is what protects this data — DB-level RLS is bypassed by
// design here.

/** Top-line counts: total users, by tier. */
export async function getUserCounts(): Promise<{
  total: number
  free: number
  basic: number
  premium: number
  paying: number
}> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('users').select('tier')
  if (error) {
    console.error('[admin/queries] getUserCounts:', error)
    return { total: 0, free: 0, basic: 0, premium: 0, paying: 0 }
  }
  const counts = { total: 0, free: 0, basic: 0, premium: 0, paying: 0 }
  for (const row of data) {
    counts.total++
    const tier = row.tier as UserTier
    if (tier === 'free') counts.free++
    else if (tier === 'basic') {
      counts.basic++
      counts.paying++
    } else if (tier === 'premium') {
      counts.premium++
      counts.paying++
    }
  }
  return counts
}

/**
 * Active paying subs by (tier × interval). Drives MRR. We count `active` and
 * `trialing` — `past_due` is excluded because Stripe will dunning-cancel
 * those if not paid, so they're not committed revenue.
 */
export async function getActiveSubBreakdown(): Promise<SubBreakdown[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('tier, billing_interval, subscription_status')
    .in('tier', ['basic', 'premium'])
    .in('subscription_status', ['active', 'trialing'])

  if (error) {
    console.error('[admin/queries] getActiveSubBreakdown:', error)
    return []
  }

  // Bucket → count
  const bucket = new Map<string, SubBreakdown>()
  for (const row of data) {
    const tier = row.tier as PaidTier
    const interval = row.billing_interval as BillingInterval | null
    if (!interval) continue // can't price an open-ended row
    const key = `${tier}:${interval}`
    const existing = bucket.get(key)
    if (existing) existing.count++
    else bucket.set(key, { tier, interval, count: 1 })
  }
  return Array.from(bucket.values())
}

/** MRR in EUR per month, rounded to cents. */
export async function getMrrEur(): Promise<number> {
  const breakdown = await getActiveSubBreakdown()
  return computeMrrEur(breakdown)
}

/** New signups created in the last `hours` window. */
export async function getSignupsSince(hours: number): Promise<number> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString()
  const { count, error } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)
  if (error) {
    console.error('[admin/queries] getSignupsSince:', error)
    return 0
  }
  return count ?? 0
}

/**
 * Active users (DAU/WAU) from `auth.users.last_sign_in_at`. We can only
 * query auth.users via the service client — the regular `users` table
 * doesn't track sign-in timestamps.
 */
export async function getActiveUsersSince(hours: number): Promise<number> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString()
  // listUsers paginates; for MVP we walk a single page (1000 max) which is
  // way larger than current user count. When we cross 500 users we'll
  // graduate to a SQL count.
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) {
    console.error('[admin/queries] getActiveUsersSince:', error)
    return 0
  }
  return data.users.filter((u) => u.last_sign_in_at && u.last_sign_in_at >= since).length
}

/** Most recent N signups for the dashboard table. */
export async function getRecentSignups(limit = 20): Promise<
  Array<{ id: string; email: string; tier: UserTier; created_at: string }>
> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, email, tier, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[admin/queries] getRecentSignups:', error)
    return []
  }
  return (data ?? []) as Array<{ id: string; email: string; tier: UserTier; created_at: string }>
}

/** Failed Stripe webhook events (processing_error not null) for ops triage. */
export async function getFailedWebhooks(limit = 20): Promise<
  Array<{ event_id: string; event_type: string; received_at: string; processing_error: string | null }>
> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('stripe_webhook_events')
    .select('event_id, event_type, received_at, processing_error')
    .not('processing_error', 'is', null)
    .order('received_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[admin/queries] getFailedWebhooks:', error)
    return []
  }
  return data ?? []
}

/** Operational state of scan + discover crons (latest run timestamps). */
export async function getCronHealth(): Promise<{
  lastScanAt: string | null
  scanResultsLast24h: number
  premiumLast24h: number
}> {
  const supabase = createServiceClient()
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString()

  // Latest row in scan_results (any) gives "most recent scan run" — every
  // scan inserts at least one row.
  const { data: latest } = await supabase
    .from('scan_results')
    .select('scanned_at')
    .order('scanned_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { count: scanResults24 } = await supabase
    .from('scan_results')
    .select('id', { count: 'exact', head: true })
    .gte('scanned_at', yesterday)

  const { count: premium24 } = await supabase
    .from('scan_results')
    .select('id', { count: 'exact', head: true })
    .gte('scanned_at', yesterday)
    .eq('is_premium', true)

  return {
    lastScanAt: latest?.scanned_at ?? null,
    scanResultsLast24h: scanResults24 ?? 0,
    premiumLast24h: premium24 ?? 0,
  }
}

/** Today's AI usage count from ai_usage_daily (no $ — table tracks calls only). */
export async function getAiUsageToday(): Promise<number> {
  const supabase = createServiceClient()
  // Day key — the table uses UTC date, matching how the scanner increments.
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const { data, error } = await supabase
    .from('ai_usage_daily')
    .select('count')
    .eq('day', today)
  if (error) {
    console.error('[admin/queries] getAiUsageToday:', error)
    return 0
  }
  return (data ?? []).reduce((s, r) => s + (r.count ?? 0), 0)
}

/** User lookup by exact-or-partial email match (admin support tool). */
export async function findUsersByEmail(needle: string, limit = 10): Promise<
  Array<{
    id: string
    email: string
    tier: UserTier
    subscription_status: SubscriptionStatus | null
    created_at: string
  }>
> {
  if (!needle.trim()) return []
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, email, tier, subscription_status, created_at')
    .ilike('email', `%${needle.trim()}%`)
    .limit(limit)
  if (error) {
    console.error('[admin/queries] findUsersByEmail:', error)
    return []
  }
  return (data ?? []) as Array<{
    id: string
    email: string
    tier: UserTier
    subscription_status: SubscriptionStatus | null
    created_at: string
  }>
}

/** Returns 'live' if STRIPE_SECRET_KEY starts with sk_live_, else 'test'. */
export function getStripeMode(): 'live' | 'test' | 'unknown' {
  const k = process.env.STRIPE_SECRET_KEY ?? ''
  if (k.startsWith('sk_live_')) return 'live'
  if (k.startsWith('sk_test_')) return 'test'
  return 'unknown'
}
