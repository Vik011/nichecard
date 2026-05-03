// supabase/functions/_shared/premiumSpike.ts
//
// Sprint A.8 — Premium spike classifier.
//
// A "premium spike channel" is what the user would personally contact for a
// collab, ad buy, or acquisition. Quality > quantity. The thresholds below
// are intentionally strict — most channels in our watchlist will fail; that
// is the point. Channels that fail still get persisted via the legacy
// outlier_ratio path so /discover keeps a feed for Basic-tier users; the
// `is_premium` flag just tags the few that clear this much higher bar.
//
// Per-format constants live at the top so they are easy to tune from env
// vars in production without redeploying. Helpers below are pure (no I/O,
// no time-of-day dependency outside `now`) so they are easy to test.

import type { VideoData } from './types.ts'

// ─── Format classification ────────────────────────────────────────────
// 2025 YouTube rule: Shorts max length is 3 minutes. Anything > 180s is
// longform regardless of aspect ratio. Aspect ratio (16:9 vs 9:16) is NOT
// exposed by Data API v3, so duration is the only reliable proxy we have.
export const SHORTS_MAX_DURATION_S = parseInt(envOrDefault('PREMIUM_SHORTS_MAX_DURATION_S', '180'), 10)

// ─── LONGFORM premium thresholds ──────────────────────────────────────
export const LONGFORM_SUBS_MIN = parseInt(envOrDefault('PREMIUM_LF_SUBS_MIN', '1000'), 10)
export const LONGFORM_VIEWS_MIN = parseInt(envOrDefault('PREMIUM_LF_VIEWS_MIN', '10000'), 10)
export const LONGFORM_VPS_MIN = parseFloat(envOrDefault('PREMIUM_LF_VPS_MIN', '10'))
export const LONGFORM_POOL_SIZE = parseInt(envOrDefault('PREMIUM_LF_POOL_SIZE', '5'), 10)
export const LONGFORM_POOL_DAYS = parseInt(envOrDefault('PREMIUM_LF_POOL_DAYS', '45'), 10)
export const LONGFORM_QUALIFY_WINDOW = parseInt(envOrDefault('PREMIUM_LF_QUALIFY_WINDOW', '3'), 10)
export const LONGFORM_QUALIFY_MIN_HITS = parseInt(envOrDefault('PREMIUM_LF_QUALIFY_MIN_HITS', '2'), 10)

// ─── SHORTS premium thresholds ────────────────────────────────────────
export const SHORTS_SUBS_MIN = parseInt(envOrDefault('PREMIUM_SH_SUBS_MIN', '100'), 10)
export const SHORTS_VIEWS_MIN = parseInt(envOrDefault('PREMIUM_SH_VIEWS_MIN', '30000'), 10)
export const SHORTS_VPS_MIN = parseFloat(envOrDefault('PREMIUM_SH_VPS_MIN', '1000'))
export const SHORTS_POOL_SIZE = parseInt(envOrDefault('PREMIUM_SH_POOL_SIZE', '8'), 10)
export const SHORTS_POOL_DAYS = parseInt(envOrDefault('PREMIUM_SH_POOL_DAYS', '30'), 10)
export const SHORTS_QUALIFY_WINDOW = parseInt(envOrDefault('PREMIUM_SH_QUALIFY_WINDOW', '5'), 10)
export const SHORTS_QUALIFY_MIN_HITS = parseInt(envOrDefault('PREMIUM_SH_QUALIFY_MIN_HITS', '3'), 10)

// ─── Spike multiplier (both formats) ──────────────────────────────────
// Recent-window avg VPS divided by older-window median VPS. Higher means
// the channel just broke out vs its own baseline — that's the "rapid growth"
// signal beyond raw view counts.
export const SPIKE_MULTIPLIER_MIN = parseFloat(envOrDefault('PREMIUM_SPIKE_MIN', '3'))
export const SPIKE_BONUS_THRESHOLD = parseFloat(envOrDefault('PREMIUM_SPIKE_BONUS', '2'))

// Read env var with default fallback. Guarded so this module also works in
// non-Deno environments (e.g. ts-jest in src/lib/scanner tests).
function envOrDefault(name: string, fallback: string): string {
  // deno-lint-ignore no-explicit-any
  const denoGlobal: any = (globalThis as any).Deno
  if (denoGlobal && typeof denoGlobal.env?.get === 'function') {
    return denoGlobal.env.get(name) ?? fallback
  }
  // Node / Jest: process.env may exist
  // deno-lint-ignore no-explicit-any
  const nodeProcess: any = (globalThis as any).process
  if (nodeProcess && nodeProcess.env) {
    return nodeProcess.env[name] ?? fallback
  }
  return fallback
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Bucket a video by length. ≤180s = Shorts (per YT 2025 rule). 0 (unknown)
 * is treated as Shorts — the safer mis-classification because Shorts go
 * through the stricter VPS gate and unknown-duration noise gets filtered out.
 */
export function classifyVideoType(durationSeconds: number): 'shorts' | 'longform' {
  return durationSeconds <= SHORTS_MAX_DURATION_S ? 'shorts' : 'longform'
}

/**
 * Views Per Subscriber. The denominator is clamped to ≥1 so we never divide
 * by zero — a 0-sub channel with any views looks "infinitely viral" via this
 * metric, but downstream gates (SUBS_MIN) reject those channels anyway.
 */
export function calculateVPS(views: number, subs: number): number {
  return views / Math.max(subs, 1)
}

/**
 * Spike multiplier = (avg VPS of recent videos) / (median VPS of older videos).
 *
 * Median for the "older" baseline is intentional: channels often have one
 * weird old video that spiked early; a mean would let it dominate, hiding
 * the recent spike. Median absorbs that.
 *
 * Returns 1.0 (neutral, "no detected spike") when there is no older history
 * to compare against. The caller still applies SPIKE_MULTIPLIER_MIN; a
 * channel with no older bucket simply can't pass the spike gate.
 */
export function detectSpikeMultiplier(
  recentVideos: VideoData[],
  olderVideos: VideoData[],
  subs: number,
): number {
  if (recentVideos.length === 0) return 1.0
  if (olderVideos.length === 0) return 1.0

  const recentVps = recentVideos.map(v => calculateVPS(v.viewCount, subs))
  const olderVps = olderVideos.map(v => calculateVPS(v.viewCount, subs))

  const recentAvg = recentVps.reduce((s, x) => s + x, 0) / recentVps.length
  const olderMedian = median(olderVps)

  if (olderMedian <= 0) return 1.0
  return recentAvg / olderMedian
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// ─── Main classifier ──────────────────────────────────────────────────

export interface PremiumSpikeChannelInput {
  contentType: 'shorts' | 'longform'
  subscriberCount: number
}

export interface PremiumSpikeResult {
  isPremium: boolean
  /** 0–100. 0 means rejected; 60+ means premium (gates passed); higher = stronger signal. */
  score: number
  /** 'premium' on success, otherwise a short machine-readable rejection reason. */
  reason: string
  qualifyingVideoCount: number
  vpsRecentAvg: number
  vpsOlderMedian: number
  spikeMultiplier: number
}

/**
 * Decide whether `channel` is a premium spike candidate based on its recent
 * uploads. See the file-header comment for what "premium" means strategically.
 *
 * Algorithm:
 *  1. Pick thresholds for the channel's content_type bucket.
 *  2. Filter `videos` to ones whose own duration matches that bucket — a
 *     "longform" channel that just published a Short shouldn't have that
 *     Short polluting the longform check (and vice versa). A channel
 *     mis-tagged at discover time gracefully fails `insufficient_videos`.
 *  3. Filter to the recency window (POOL_DAYS) and take the most recent
 *     POOL_SIZE.
 *  4. Apply hard gates: SUBS_MIN, then enough videos in pool to evaluate.
 *  5. Among the freshest QUALIFY_WINDOW of the pool, count how many hit
 *     both VIEWS_MIN AND VPS_MIN. Need at least QUALIFY_MIN_HITS.
 *  6. Spike check: avg VPS of those qualifying-window videos vs median VPS
 *     of the rest of the pool. Need ≥ SPIKE_MULTIPLIER_MIN.
 *  7. Score: base 60 for clearing all gates, bonuses for full sweep / strong
 *     spike / strong VPS.
 */
export function isPremiumSpikeChannel(
  channel: PremiumSpikeChannelInput,
  videos: VideoData[],
  now: Date = new Date(),
): PremiumSpikeResult {
  const isLongform = channel.contentType === 'longform'

  const SUBS_MIN = isLongform ? LONGFORM_SUBS_MIN : SHORTS_SUBS_MIN
  const VIEWS_MIN = isLongform ? LONGFORM_VIEWS_MIN : SHORTS_VIEWS_MIN
  const VPS_MIN = isLongform ? LONGFORM_VPS_MIN : SHORTS_VPS_MIN
  const POOL_SIZE = isLongform ? LONGFORM_POOL_SIZE : SHORTS_POOL_SIZE
  const POOL_DAYS = isLongform ? LONGFORM_POOL_DAYS : SHORTS_POOL_DAYS
  const QUALIFY_WINDOW = isLongform ? LONGFORM_QUALIFY_WINDOW : SHORTS_QUALIFY_WINDOW
  const QUALIFY_MIN_HITS = isLongform ? LONGFORM_QUALIFY_MIN_HITS : SHORTS_QUALIFY_MIN_HITS

  const empty: PremiumSpikeResult = {
    isPremium: false,
    score: 0,
    reason: '',
    qualifyingVideoCount: 0,
    vpsRecentAvg: 0,
    vpsOlderMedian: 0,
    spikeMultiplier: 0,
  }

  // Filter to format-matching videos.
  const formatMatched = videos.filter(v => {
    const t = classifyVideoType(v.durationSeconds)
    return isLongform ? t === 'longform' : t === 'shorts'
  })

  // Filter to recency window.
  const cutoff = now.getTime() - POOL_DAYS * 24 * 60 * 60 * 1000
  const inWindow = formatMatched.filter(v => new Date(v.publishedAt).getTime() >= cutoff)

  // Sort newest first, take top POOL_SIZE.
  const pool = [...inWindow]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, POOL_SIZE)

  // Gate: subscriber floor.
  if (channel.subscriberCount < SUBS_MIN) {
    return { ...empty, reason: `subs_too_low (${channel.subscriberCount} < ${SUBS_MIN})` }
  }

  // Gate: enough videos to even evaluate.
  if (pool.length < QUALIFY_WINDOW) {
    return { ...empty, reason: `insufficient_videos (${pool.length} < ${QUALIFY_WINDOW})` }
  }

  // Qualifying hits: each of the top QUALIFY_WINDOW videos must clear both
  // the absolute view floor AND the VPS floor.
  const qualifyingPool = pool.slice(0, QUALIFY_WINDOW)
  const hits = qualifyingPool.filter(
    v => v.viewCount >= VIEWS_MIN && calculateVPS(v.viewCount, channel.subscriberCount) >= VPS_MIN,
  )

  // Recent / older buckets for spike detection — split pool at QUALIFY_WINDOW.
  const olderBucket = pool.slice(QUALIFY_WINDOW)
  const spikeMultiplier = detectSpikeMultiplier(qualifyingPool, olderBucket, channel.subscriberCount)
  const vpsRecentAvg = avg(qualifyingPool.map(v => calculateVPS(v.viewCount, channel.subscriberCount)))
  const vpsOlderMedian = olderBucket.length > 0
    ? median(olderBucket.map(v => calculateVPS(v.viewCount, channel.subscriberCount)))
    : 0

  if (hits.length < QUALIFY_MIN_HITS) {
    return {
      isPremium: false,
      score: 0,
      reason: `below_qualify_threshold (${hits.length}/${QUALIFY_WINDOW})`,
      qualifyingVideoCount: hits.length,
      vpsRecentAvg: round2(vpsRecentAvg),
      vpsOlderMedian: round2(vpsOlderMedian),
      spikeMultiplier: round2(spikeMultiplier),
    }
  }

  if (spikeMultiplier < SPIKE_MULTIPLIER_MIN) {
    return {
      isPremium: false,
      score: 0,
      reason: `no_spike (${spikeMultiplier.toFixed(2)}x < ${SPIKE_MULTIPLIER_MIN}x)`,
      qualifyingVideoCount: hits.length,
      vpsRecentAvg: round2(vpsRecentAvg),
      vpsOlderMedian: round2(vpsOlderMedian),
      spikeMultiplier: round2(spikeMultiplier),
    }
  }

  // Passed all gates. Build score.
  let score = 60
  if (hits.length === QUALIFY_WINDOW) score += 10
  if (spikeMultiplier >= SPIKE_BONUS_THRESHOLD * SPIKE_MULTIPLIER_MIN) score += 20
  const hitsAvgVps = avg(hits.map(v => calculateVPS(v.viewCount, channel.subscriberCount)))
  if (hitsAvgVps >= 2 * VPS_MIN) score += 10
  if (score > 100) score = 100

  return {
    isPremium: true,
    score,
    reason: 'premium',
    qualifyingVideoCount: hits.length,
    vpsRecentAvg: round2(vpsRecentAvg),
    vpsOlderMedian: round2(vpsOlderMedian),
    spikeMultiplier: round2(spikeMultiplier),
  }
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

function round2(x: number): number {
  return Math.round(x * 100) / 100
}
