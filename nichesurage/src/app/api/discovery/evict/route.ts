/**
 * Eviction cron — Phase 5b stale-channel cleanup.
 *
 * Without eviction the watchlist becomes a museum of every channel we ever
 * touched, including dead ones from old setups. The trend engine then
 * scans them every 6h burning quota and the UI shows their stale results.
 *
 * Rules (per Sprint B v2 amendment A1):
 *   permanent -> evicted: no trend_score > 30 in last 30 days
 *                         AND no membership in any cluster in last 14 days
 *   observed  -> evicted: no trend_score > 50 in last 21 days
 *   candidate -> evicted: no trend_score > 50 in last 7 days (TTL)
 *
 * Eviction is REVERSIBLE — sets is_active=false + evicted_at=now() rather
 * than deleting the row. A future expand pass can re-add the same channel
 * (the ON CONFLICT path will see it but skip; we'd need an explicit
 * un-evict path to re-activate; left as a follow-up).
 *
 * Schedule: 1×/day at 03:00 UTC (vercel.json).
 */

import { createServiceClient } from '@/lib/supabase/service'
import { checkCronSecret } from '@/lib/discovery/channelOnboard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface EvictRule {
  tier: 'permanent' | 'observed' | 'candidate'
  scoreFloor: number
  windowDays: number
  /** Optional extra condition: also require no cluster membership in last N days. */
  requireNoClusterDays?: number
}

const EVICT_RULES: EvictRule[] = [
  { tier: 'permanent', scoreFloor: 30, windowDays: 30, requireNoClusterDays: 14 },
  { tier: 'observed',  scoreFloor: 50, windowDays: 21 },
  { tier: 'candidate', scoreFloor: 50, windowDays: 7 },
]

interface RuleOutcome {
  tier: string
  scoreFloor: number
  windowDays: number
  evicted: number
  error?: string
}

/**
 * Fetch youtube_channel_ids for the given tier that have no recent strong
 * trend signal. Done client-side rather than via a single SQL UPDATE
 * because Supabase JS doesn't expose NOT EXISTS subqueries cleanly, and
 * we want to log exactly which channels we hit.
 *
 * The query approach:
 *   1. Get all active permanent/observed/candidate rows
 *   2. Get all channel_ids that DO have a trend_score above floor in window
 *   3. Set difference is the eviction list
 */
async function fetchEvictionCandidates(
  supabase: ReturnType<typeof createServiceClient>,
  rule: EvictRule,
): Promise<string[]> {
  const sinceIso = new Date(
    Date.now() - rule.windowDays * 86400 * 1000,
  ).toISOString()

  // Step 1: active rows of this tier
  const { data: candidateRows, error: candidatesErr } = await supabase
    .from('channels_watchlist')
    .select('youtube_channel_id, tier_entered_at')
    .eq('tier', rule.tier)
    .eq('is_active', true)
    .is('evicted_at', null)
    .limit(50_000)

  if (candidatesErr) {
    throw new Error(`fetch candidates: ${candidatesErr.message}`)
  }
  const candidates = (candidateRows ?? []) as Array<{
    youtube_channel_id: string
    tier_entered_at: string
  }>
  if (candidates.length === 0) return []

  // Defensive: don't evict freshly-tier-entered rows. A candidate that
  // entered yesterday has no chance to accrue 7d of trend_score history
  // yet — the rule says "no signal in last N days" which is moot when the
  // channel hasn't existed in the engine that long.
  const minAgeMs = Math.min(rule.windowDays, 3) * 86400 * 1000
  const cutoffEntered = new Date(Date.now() - minAgeMs).toISOString()
  const eligible = candidates.filter((c) => c.tier_entered_at <= cutoffEntered)
  if (eligible.length === 0) return []
  const eligibleIds = new Set(eligible.map((c) => c.youtube_channel_id))

  // Step 2: channels that DO have a recent strong score
  const { data: signalRows, error: signalErr } = await supabase
    .from('video_metrics')
    .select('channel_id')
    .gt('trend_score', rule.scoreFloor)
    .gte('computed_at', sinceIso)
    .limit(50_000)

  if (signalErr) {
    throw new Error(`fetch signal: ${signalErr.message}`)
  }
  const channelsWithSignal = new Set<string>(
    ((signalRows ?? []) as Array<{ channel_id: string }>)
      .map((r) => r.channel_id)
      .filter((c): c is string => Boolean(c)),
  )

  // Optional: also require no cluster membership in last N days
  let channelsWithCluster = new Set<string>()
  if (rule.requireNoClusterDays) {
    const clusterSince = new Date(
      Date.now() - rule.requireNoClusterDays * 86400 * 1000,
    ).toISOString()
    const { data: clusterRows } = await supabase
      .from('trend_cluster_members')
      .select('video_id, cluster_id, trend_clusters!inner(last_updated_at)')
      .gte('trend_clusters.last_updated_at', clusterSince)
      .limit(50_000)
    // Translate video_id -> channel_id via video_metrics
    const videoIds = ((clusterRows ?? []) as Array<{ video_id: string }>).map(
      (r) => r.video_id,
    )
    if (videoIds.length > 0) {
      const { data: vmRows } = await supabase
        .from('video_metrics')
        .select('channel_id')
        .in('video_id', videoIds)
      channelsWithCluster = new Set(
        ((vmRows ?? []) as Array<{ channel_id: string }>)
          .map((r) => r.channel_id)
          .filter((c): c is string => Boolean(c)),
      )
    }
  }

  // Eviction = eligible − (channelsWithSignal ∪ channelsWithCluster)
  const evictIds: string[] = []
  for (const id of Array.from(eligibleIds)) {
    if (channelsWithSignal.has(id)) continue
    if (channelsWithCluster.has(id)) continue
    evictIds.push(id)
  }
  return evictIds
}

async function evictChannels(
  supabase: ReturnType<typeof createServiceClient>,
  channelIds: string[],
): Promise<number> {
  if (channelIds.length === 0) return 0
  const nowIso = new Date().toISOString()
  // Batch into groups of 500 to avoid massive IN clauses.
  let updated = 0
  for (let i = 0; i < channelIds.length; i += 500) {
    const batch = channelIds.slice(i, i + 500)
    const { error, count } = await supabase
      .from('channels_watchlist')
      .update(
        { is_active: false, evicted_at: nowIso },
        { count: 'exact' },
      )
      .in('youtube_channel_id', batch)
    if (error) {
      console.error('[discovery/evict] batch update failed', error.message)
      continue
    }
    updated += count ?? batch.length
  }
  return updated
}

export async function GET(request: Request) {
  if (!checkCronSecret(request)) {
    return new Response('unauthorized', { status: 401 })
  }
  const supabase = createServiceClient()
  const startedAt = Date.now()
  const outcomes: RuleOutcome[] = []

  for (const rule of EVICT_RULES) {
    const outcome: RuleOutcome = {
      tier: rule.tier,
      scoreFloor: rule.scoreFloor,
      windowDays: rule.windowDays,
      evicted: 0,
    }
    try {
      const ids = await fetchEvictionCandidates(supabase, rule)
      outcome.evicted = await evictChannels(supabase, ids)
    } catch (err) {
      outcome.error = err instanceof Error ? err.message : String(err)
      console.error('[discovery/evict] rule failed', rule.tier, outcome.error)
    }
    outcomes.push(outcome)
  }

  const totalEvicted = outcomes.reduce((s, o) => s + o.evicted, 0)
  const elapsedMs = Date.now() - startedAt
  console.log(
    '[discovery/evict] done',
    JSON.stringify({ totalEvicted, elapsedMs, outcomes }),
  )

  return Response.json({
    ok: true,
    totalEvicted,
    elapsedMs,
    outcomes,
  })
}
