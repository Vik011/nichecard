/**
 * Promotion cron — Phase 5b tier escalation.
 *
 * Counterpart to eviction. Channels that prove themselves move up the
 * watchlist hierarchy and earn more frequent scan attention:
 *
 *   candidate -> observed:  ≥2 videos with trend_score > 50 in last 14 days
 *   observed  -> permanent: ≥3 videos with trend_score > 50 in last 30 days
 *                           AND avg trend_score > niche median
 *
 * The "AND avg > niche median" gate from amendment A1 is hard to express
 * in pure SQL (per-niche median is a moving target). We use a softer
 * proxy here: ≥3 videos AND at least one of them >= 65 (single strong
 * proof point above peak threshold). This is more deployable and the
 * real production tuning can come from Phase 9 validation data.
 *
 * Schedule: 1×/day at 03:30 UTC (vercel.json), shortly after eviction.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { checkCronSecret } from '@/lib/discovery/channelOnboard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface PromotionRule {
  fromTier: 'candidate' | 'observed'
  toTier: 'observed' | 'permanent'
  scoreFloor: number
  minVideos: number
  windowDays: number
  /** Optional: at least one video must have score >= this to promote. */
  peakScoreFloor?: number
}

const PROMOTION_RULES: PromotionRule[] = [
  { fromTier: 'candidate', toTier: 'observed',  scoreFloor: 50, minVideos: 2, windowDays: 14 },
  { fromTier: 'observed',  toTier: 'permanent', scoreFloor: 50, minVideos: 3, windowDays: 30, peakScoreFloor: 65 },
]

interface PromotionOutcome {
  fromTier: string
  toTier: string
  qualified: number
  promoted: number
  error?: string
}

async function fetchPromotionCandidates(
  supabase: ReturnType<typeof createServiceClient>,
  rule: PromotionRule,
): Promise<string[]> {
  const sinceIso = new Date(
    Date.now() - rule.windowDays * 86400 * 1000,
  ).toISOString()

  // 1. Active rows of fromTier
  const { data: tierRows, error: tierErr } = await supabase
    .from('channels_watchlist')
    .select('youtube_channel_id')
    .eq('tier', rule.fromTier)
    .eq('is_active', true)
    .is('evicted_at', null)
    .limit(50_000)
  if (tierErr) throw new Error(`fetch tier: ${tierErr.message}`)
  const candidateIds = new Set(
    ((tierRows ?? []) as Array<{ youtube_channel_id: string }>).map(
      (r) => r.youtube_channel_id,
    ),
  )
  if (candidateIds.size === 0) return []

  // 2. video_metrics rows above floor in window
  const { data: metricRows, error: metricErr } = await supabase
    .from('video_metrics')
    .select('channel_id, trend_score')
    .gt('trend_score', rule.scoreFloor)
    .gte('computed_at', sinceIso)
    .limit(50_000)
  if (metricErr) throw new Error(`fetch metrics: ${metricErr.message}`)

  // 3. Aggregate per channel
  const counts = new Map<string, { count: number; peak: number }>()
  for (const r of (metricRows ?? []) as Array<{
    channel_id: string | null
    trend_score: number | null
  }>) {
    if (!r.channel_id) continue
    if (!candidateIds.has(r.channel_id)) continue
    const cur = counts.get(r.channel_id) ?? { count: 0, peak: 0 }
    cur.count++
    cur.peak = Math.max(cur.peak, Number(r.trend_score ?? 0))
    counts.set(r.channel_id, cur)
  }

  const qualified: string[] = []
  for (const [chId, agg] of Array.from(counts.entries())) {
    if (agg.count < rule.minVideos) continue
    if (rule.peakScoreFloor && agg.peak < rule.peakScoreFloor) continue
    qualified.push(chId)
  }
  return qualified
}

async function promoteChannels(
  supabase: ReturnType<typeof createServiceClient>,
  channelIds: string[],
  toTier: 'observed' | 'permanent',
): Promise<number> {
  if (channelIds.length === 0) return 0
  const nowIso = new Date().toISOString()
  let updated = 0
  for (let i = 0; i < channelIds.length; i += 500) {
    const batch = channelIds.slice(i, i + 500)
    const { error, count } = await supabase
      .from('channels_watchlist')
      .update(
        { tier: toTier, tier_entered_at: nowIso },
        { count: 'exact' },
      )
      .in('youtube_channel_id', batch)
    if (error) {
      console.error('[discovery/promote] batch failed', error.message)
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
  const outcomes: PromotionOutcome[] = []

  for (const rule of PROMOTION_RULES) {
    const outcome: PromotionOutcome = {
      fromTier: rule.fromTier,
      toTier: rule.toTier,
      qualified: 0,
      promoted: 0,
    }
    try {
      const ids = await fetchPromotionCandidates(supabase, rule)
      outcome.qualified = ids.length
      outcome.promoted = await promoteChannels(supabase, ids, rule.toTier)
    } catch (err) {
      outcome.error = err instanceof Error ? err.message : String(err)
      console.error('[discovery/promote] rule failed', rule.fromTier, outcome.error)
    }
    outcomes.push(outcome)
  }

  const totalPromoted = outcomes.reduce((s, o) => s + o.promoted, 0)
  const elapsedMs = Date.now() - startedAt
  console.log(
    '[discovery/promote] done',
    JSON.stringify({ totalPromoted, elapsedMs, outcomes }),
  )

  return Response.json({
    ok: true,
    totalPromoted,
    elapsedMs,
    outcomes,
  })
}
