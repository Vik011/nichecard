// supabase/functions/_shared/trendScore.ts
//
// Sprint B Phase 6: weighted 0-100 trend score combining velocity,
// engagement, novelty, replication-cluster membership, and lifecycle
// stage. Replaces legacy outlier_ratio as primary discovery signal.
//
// Pure function. No I/O.
//
// Formula constants are exported so production tuning can be done
// without redeploy via environment override pattern (Phase 9 validation
// cycle per plan A14).

import type { LifecycleStatus } from './types.ts'

export interface TrendScoreInput {
  viewsPerHour: number
  velocityDelta: number       // ratio: latest_segment / prior_segment
  viewAcceleration: number    // raw second-derivative (per hour^2)
  commentsPerHour: number
  likesPerHour: number
  performanceRatio: number    // actual/expected (replaces breakoutRatio per A5)
  noveltyScore: number        // niche-relative multiplier
  inReplicationCluster: boolean
  clusterSize: number
  lifecycleStatus: LifecycleStatus
}

// Weights (exported — tunable). Tuning notes documented in CLAUDE.md.
export const TREND_WEIGHTS = {
  viewsPerHour: 12,         // log10(1+vph) × 12 → 0..50 typical
  velocityDelta: 4,         // clamp(0..10) × 4 → 0..40
  viewAcceleration: 1,      // clamp(0..20) × 1 (normalized by /1000)
  commentsPerHour: 8,       // log10(1+cph) × 8 — strong leading signal
  performanceRatio: 8,      // clamp(log10(1+ratio), 0..2) × 8 → 0..16
  noveltyScore: 6,          // clamp(0..5) × 6 → 0..30
  clusterPerMember: 2,      // min(clusterSize, 20) × 2 → 0..40
} as const

// Lifecycle multipliers (per A3).
export const LIFECYCLE_MULTIPLIER: Record<LifecycleStatus, number> = {
  emerging: 1.30,
  exploding: 1.20,
  peak: 1.00,
  saturated: 0.70,
  dying: 0.40,
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  if (n < min) return min
  if (n > max) return max
  return n
}

function safeLog10Plus1(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.log10(1 + n)
}

/**
 * Compute weighted trend_score in [0..100]. Pure.
 *
 * Formula (raw, before clamp + lifecycle multiplier):
 *   raw =
 *     log10(1+vph)        × 12
 *   + clamp(velocityDelta, 0, 10) × 4
 *   + clamp(viewAcceleration/1000, 0, 20) × 1
 *   + log10(1+cph)        × 8
 *   + clamp(log10(1+performanceRatio), 0, 2) × 8
 *   + clamp(noveltyScore, 0, 5) × 6
 *   + (inReplicationCluster ? min(clusterSize, 20) × 2 : 0)
 *
 * Then: result = min(100, raw × LIFECYCLE_MULTIPLIER[status])
 *
 * Defensive: any non-finite input → that term contributes 0.
 */
export function computeTrendScore(input: TrendScoreInput): number {
  const vphTerm = safeLog10Plus1(input.viewsPerHour) * TREND_WEIGHTS.viewsPerHour
  const deltaTerm = clamp(input.velocityDelta, 0, 10) * TREND_WEIGHTS.velocityDelta
  const accelTerm = clamp(input.viewAcceleration / 1000, 0, 20) * TREND_WEIGHTS.viewAcceleration
  const cphTerm = safeLog10Plus1(input.commentsPerHour) * TREND_WEIGHTS.commentsPerHour
  // likesPerHour intentionally unused in the headline weights — kept in
  // the input shape for future tuning. Comments are stronger leading
  // signal than likes (lower base rate, higher engagement floor).
  const perfTerm = clamp(safeLog10Plus1(input.performanceRatio), 0, 2)
    * TREND_WEIGHTS.performanceRatio
  const noveltyTerm = clamp(input.noveltyScore, 0, 5) * TREND_WEIGHTS.noveltyScore
  const clusterTerm = input.inReplicationCluster
    ? Math.min(Math.max(input.clusterSize, 0), 20) * TREND_WEIGHTS.clusterPerMember
    : 0

  const raw = vphTerm + deltaTerm + accelTerm + cphTerm + perfTerm + noveltyTerm + clusterTerm
  const multiplier = LIFECYCLE_MULTIPLIER[input.lifecycleStatus] ?? 1.0
  const adjusted = raw * multiplier
  return Math.min(100, Math.max(0, adjusted))
}
