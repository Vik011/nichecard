// supabase/functions/_shared/trendScore.test.ts
//
// Sprint B Phase 6: tests for the weighted trend_score formula.
// Pure-function tests — no I/O.
//
// Deno test runner (Jest ignores supabase/functions per jest.config.ts).
// Run locally: `deno test supabase/functions/_shared/trendScore.test.ts`
import {
  assertAlmostEquals,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  LIFECYCLE_MULTIPLIER,
  TREND_WEIGHTS,
  computeTrendScore,
  type TrendScoreInput,
} from './trendScore.ts'
import type { LifecycleStatus } from './types.ts'

function input(overrides: Partial<TrendScoreInput> = {}): TrendScoreInput {
  return {
    viewsPerHour: 0,
    velocityDelta: 0,
    viewAcceleration: 0,
    commentsPerHour: 0,
    likesPerHour: 0,
    performanceRatio: 0,
    noveltyScore: 0,
    inReplicationCluster: false,
    clusterSize: 0,
    lifecycleStatus: 'peak',
    ...overrides,
  }
}

// ─── Boundary cases ─────────────────────────────────────────────────

Deno.test('trendScore: all-zeros input → 0', () => {
  assertEquals(computeTrendScore(input()), 0)
})

Deno.test('trendScore: modest video (vph=1, delta=1, peak) → small score < 10', () => {
  // log10(2)*12 ≈ 3.61; delta clamp(1,0,10)*4 = 4; total ≈ 7.61 × 1.0 = 7.61
  const s = computeTrendScore(input({
    viewsPerHour: 1,
    velocityDelta: 1,
    lifecycleStatus: 'peak',
  }))
  assertEquals(s < 10, true)
  assertEquals(s > 0, true)
})

// ─── Hot exploding video ────────────────────────────────────────────

const hotInput: TrendScoreInput = {
  viewsPerHour: 500,
  velocityDelta: 5,
  viewAcceleration: 0,
  commentsPerHour: 50,
  likesPerHour: 0,
  performanceRatio: 30,
  noveltyScore: 3,
  inReplicationCluster: true,
  clusterSize: 8,
  lifecycleStatus: 'exploding',
}

Deno.test('trendScore: hot exploding video → score > 70 (and capped ≤100)', () => {
  const s = computeTrendScore(hotInput)
  assertEquals(s > 70, true)
  assertEquals(s <= 100, true)
})

Deno.test('trendScore: same hot input but lifecycle=dying → score < 50', () => {
  const s = computeTrendScore({ ...hotInput, lifecycleStatus: 'dying' })
  assertEquals(s < 50, true)
  assertEquals(s > 0, true)
})

Deno.test('trendScore: same hot input but lifecycle=emerging → capped at 100', () => {
  const s = computeTrendScore({ ...hotInput, lifecycleStatus: 'emerging' })
  // raw × 1.30 should overshoot 100, so result is 100.
  assertEquals(s, 100)
})

// ─── Cluster cap ────────────────────────────────────────────────────

Deno.test('trendScore: cluster of 100 == cluster of 20 (clamped)', () => {
  const big = computeTrendScore(input({
    inReplicationCluster: true,
    clusterSize: 100,
    lifecycleStatus: 'peak',
  }))
  const cap = computeTrendScore(input({
    inReplicationCluster: true,
    clusterSize: 20,
    lifecycleStatus: 'peak',
  }))
  assertEquals(big, cap)
})

Deno.test('trendScore: cluster of 0 with inReplicationCluster=true → 0 cluster term', () => {
  const noCluster = computeTrendScore(input({ lifecycleStatus: 'peak' }))
  const zero = computeTrendScore(input({
    inReplicationCluster: true,
    clusterSize: 0,
    lifecycleStatus: 'peak',
  }))
  assertEquals(zero, noCluster)
})

Deno.test('trendScore: cluster=10 with inReplicationCluster=false → 0 cluster term', () => {
  const flagged = computeTrendScore(input({
    inReplicationCluster: false,
    clusterSize: 10,
    lifecycleStatus: 'peak',
  }))
  assertEquals(flagged, 0)
})

// ─── Log scale: comments per hour ───────────────────────────────────

Deno.test('trendScore: cph=10 vs cph=100 differ by ~weight × log10(101/11)', () => {
  const s10 = computeTrendScore(input({ commentsPerHour: 10, lifecycleStatus: 'peak' }))
  const s100 = computeTrendScore(input({ commentsPerHour: 100, lifecycleStatus: 'peak' }))
  // s100 - s10 = 8 * (log10(101) - log10(11)) ≈ 8 * (2.0043 - 1.0414) = 7.703
  const diff = s100 - s10
  assertAlmostEquals(diff, 8 * (Math.log10(101) - Math.log10(11)), 0.001)
  // 10× input does NOT yield 10× score
  assertEquals(diff < s10 * 9, true)
})

// ─── performanceRatio defensive ─────────────────────────────────────

Deno.test('trendScore: performanceRatio=0 contributes 0', () => {
  const withZero = computeTrendScore(input({
    performanceRatio: 0,
    viewsPerHour: 100,
    lifecycleStatus: 'peak',
  }))
  const withRatio = computeTrendScore(input({
    performanceRatio: 5,
    viewsPerHour: 100,
    lifecycleStatus: 'peak',
  }))
  assertEquals(withRatio > withZero, true)
})

Deno.test('trendScore: huge performanceRatio clamped via log10 (capped at 2)', () => {
  // log10(1+ratio) clamped to 2 means perf term cannot exceed 16.
  const giant = computeTrendScore(input({
    performanceRatio: 1_000_000,
    lifecycleStatus: 'peak',
  }))
  // Should equal exactly 2 * 8 = 16 (no other terms).
  assertAlmostEquals(giant, 16, 0.001)
})

// ─── Lifecycle multiplier — verify each branch ──────────────────────

Deno.test('trendScore: emerging multiplier = 1.30', () => {
  assertEquals(LIFECYCLE_MULTIPLIER.emerging, 1.30)
})
Deno.test('trendScore: exploding multiplier = 1.20', () => {
  assertEquals(LIFECYCLE_MULTIPLIER.exploding, 1.20)
})
Deno.test('trendScore: peak multiplier = 1.00', () => {
  assertEquals(LIFECYCLE_MULTIPLIER.peak, 1.00)
})
Deno.test('trendScore: saturated multiplier = 0.70', () => {
  assertEquals(LIFECYCLE_MULTIPLIER.saturated, 0.70)
})
Deno.test('trendScore: dying multiplier = 0.40', () => {
  assertEquals(LIFECYCLE_MULTIPLIER.dying, 0.40)
})

Deno.test('trendScore: each lifecycle stage scales the same raw input proportionally', () => {
  const baseInput = input({ viewsPerHour: 100, lifecycleStatus: 'peak' })
  const peakScore = computeTrendScore(baseInput)
  const stages: LifecycleStatus[] = ['emerging', 'exploding', 'peak', 'saturated', 'dying']
  for (const stage of stages) {
    const s = computeTrendScore({ ...baseInput, lifecycleStatus: stage })
    const expected = Math.min(100, peakScore * LIFECYCLE_MULTIPLIER[stage])
    assertAlmostEquals(s, expected, 0.001)
  }
})

// ─── Score bounds — never <0, never >100 ────────────────────────────

Deno.test('trendScore: score never below 0 (negative inputs defensive)', () => {
  const s = computeTrendScore(input({
    viewsPerHour: -1000,
    velocityDelta: -50,
    viewAcceleration: -1_000_000,
    commentsPerHour: -10,
    performanceRatio: -100,
    noveltyScore: -10,
    lifecycleStatus: 'peak',
  }))
  assertEquals(s, 0)
})

Deno.test('trendScore: score never above 100 even with malicious huge inputs', () => {
  const s = computeTrendScore({
    viewsPerHour: Number.MAX_SAFE_INTEGER,
    velocityDelta: 1e9,
    viewAcceleration: 1e12,
    commentsPerHour: Number.MAX_SAFE_INTEGER,
    likesPerHour: Number.MAX_SAFE_INTEGER,
    performanceRatio: Number.MAX_SAFE_INTEGER,
    noveltyScore: 1e9,
    inReplicationCluster: true,
    clusterSize: Number.MAX_SAFE_INTEGER,
    lifecycleStatus: 'emerging',
  })
  assertEquals(s, 100)
})

Deno.test('trendScore: NaN inputs treated defensively (no NaN result)', () => {
  const s = computeTrendScore(input({
    viewsPerHour: NaN,
    velocityDelta: NaN,
    viewAcceleration: NaN,
    commentsPerHour: NaN,
    performanceRatio: NaN,
    noveltyScore: NaN,
    lifecycleStatus: 'peak',
  }))
  assertEquals(Number.isFinite(s), true)
  assertEquals(s, 0)
})

// ─── Weight tunability ──────────────────────────────────────────────

Deno.test('trendScore: weights are exported (tunable)', () => {
  assertEquals(typeof TREND_WEIGHTS.viewsPerHour, 'number')
  assertEquals(typeof TREND_WEIGHTS.velocityDelta, 'number')
  assertEquals(typeof TREND_WEIGHTS.viewAcceleration, 'number')
  assertEquals(typeof TREND_WEIGHTS.commentsPerHour, 'number')
  assertEquals(typeof TREND_WEIGHTS.performanceRatio, 'number')
  assertEquals(typeof TREND_WEIGHTS.noveltyScore, 'number')
  assertEquals(typeof TREND_WEIGHTS.clusterPerMember, 'number')
})

// ─── likesPerHour intentionally unused — verify ─────────────────────

Deno.test('trendScore: likesPerHour does not affect score (currently unused)', () => {
  const a = computeTrendScore(input({ likesPerHour: 0, lifecycleStatus: 'peak' }))
  const b = computeTrendScore(input({ likesPerHour: 100_000, lifecycleStatus: 'peak' }))
  assertEquals(a, b)
})

// ─── viewAcceleration normalization ─────────────────────────────────

Deno.test('trendScore: viewAcceleration normalized by /1000 then clamped to 20', () => {
  // accel = 50000 → 50 → clamp to 20 → contributes 20 × 1 = 20
  const big = computeTrendScore(input({
    viewAcceleration: 50000,
    lifecycleStatus: 'peak',
  }))
  // accel = 20000 → 20 → contributes 20
  const equal = computeTrendScore(input({
    viewAcceleration: 20000,
    lifecycleStatus: 'peak',
  }))
  assertEquals(big, equal)
  assertAlmostEquals(big, 20, 0.001)
})
