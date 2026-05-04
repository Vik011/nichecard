// supabase/functions/_shared/expectedPerformance.test.ts
//
// Sprint B Phase 6: tests for the statistical expected-views model
// (per A5 amendment). Pure-function tests — no I/O.
//
// Deno test runner (Jest ignores supabase/functions per jest.config.ts).
// Run locally: `deno test supabase/functions/_shared/expectedPerformance.test.ts`
import {
  assertAlmostEquals,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { expectedViews, performanceRatio } from './expectedPerformance.ts'

// ─── expectedViews ──────────────────────────────────────────────────

Deno.test('expectedViews: small channel (500 subs, niche=2 vps, 24h) → ~700', () => {
  // subAdjustment = log10(max(500/100,1) + 1) = log10(6) ≈ 0.778
  // expected = 2 * 500 * 0.778 * (24/24) = 778
  const e = expectedViews(500, 2, 24)
  // Allow loose tolerance — exact value is 2 * 500 * log10(6) ≈ 778.15
  assertAlmostEquals(e, 778.15, 1)
})

Deno.test('expectedViews: small channel outperformer → ratio ~6.4', () => {
  // actual=5000, expected≈778 → ratio ≈ 6.43 (≥6, ≤8)
  const e = expectedViews(500, 2, 24)
  const ratio = performanceRatio(5000, e)
  assertEquals(ratio > 6, true)
  assertEquals(ratio < 8, true)
})

Deno.test('expectedViews: huge channel underperformer → ratio < 0.1', () => {
  // 5M subs, niche=2 vps, 24h, actual=200_000
  // subAdjustment = log10(max(50000,1)+1) = log10(50001) ≈ 4.699
  // expected = 2 * 5_000_000 * 4.699 * 1 ≈ 46_990_000
  // ratio = 200_000 / 46_990_000 ≈ 0.00425
  const e = expectedViews(5_000_000, 2, 24)
  const ratio = performanceRatio(200_000, e)
  assertEquals(ratio < 0.1, true)
  assertEquals(ratio > 0, true)
})

Deno.test('expectedViews: zero subs → fallback to 100, expected positive', () => {
  // safeSubs=100, subAdjustment = log10(max(1,1)+1) = log10(2) ≈ 0.301
  // expected = 2 * 100 * 0.301 * (24/24) = 60.2
  const e = expectedViews(0, 2, 24)
  assertEquals(e > 1, true)
  assertAlmostEquals(e, 60.2, 0.5)
})

Deno.test('expectedViews: zero hours → minimum 1 hour', () => {
  // hours clamped to 1; expected = 2 * 100 * log10(2) * (1/24) ≈ 2.51
  const e = expectedViews(100, 2, 0)
  assertEquals(e > 1, true)
  assertAlmostEquals(e, 100 * 2 * Math.log10(2) * (1 / 24), 0.001)
})

Deno.test('expectedViews: negative hours → minimum 1', () => {
  const e = expectedViews(100, 2, -5)
  assertAlmostEquals(e, 100 * 2 * Math.log10(2) * (1 / 24), 0.001)
})

Deno.test('expectedViews: nicheMedianVps=0 → expected=1 (floor)', () => {
  const e = expectedViews(1000, 0, 24)
  assertEquals(e, 1)
})

Deno.test('expectedViews: negative nicheMedianVps → expected=1 (floor)', () => {
  const e = expectedViews(1000, -3, 24)
  assertEquals(e, 1)
})

Deno.test('expectedViews: NaN subs → fallback', () => {
  const e = expectedViews(NaN, 2, 24)
  // safeSubs=100 → expected = 2 * 100 * log10(2) * 1 ≈ 60.2
  assertAlmostEquals(e, 60.2, 0.5)
})

Deno.test('expectedViews: NaN nicheMedianVps → expected=1', () => {
  const e = expectedViews(1000, NaN, 24)
  assertEquals(e, 1)
})

Deno.test('expectedViews: NaN hours → expected uses 1h', () => {
  const e = expectedViews(100, 2, NaN)
  assertAlmostEquals(e, 100 * 2 * Math.log10(2) * (1 / 24), 0.001)
})

Deno.test('expectedViews: result always ≥1', () => {
  // Tiny inputs that would otherwise give a near-zero number.
  const e = expectedViews(1, 0.0001, 1)
  assertEquals(e >= 1, true)
})

// ─── performanceRatio ───────────────────────────────────────────────

Deno.test('performanceRatio: actualViews=0 → 0', () => {
  assertEquals(performanceRatio(0, 100), 0)
})

Deno.test('performanceRatio: expected=0 → 0 (defensive div/0)', () => {
  assertEquals(performanceRatio(1000, 0), 0)
})

Deno.test('performanceRatio: expected=-1 → 0 (defensive)', () => {
  assertEquals(performanceRatio(1000, -1), 0)
})

Deno.test('performanceRatio: NaN actualViews → 0', () => {
  assertEquals(performanceRatio(NaN, 100), 0)
})

Deno.test('performanceRatio: NaN expected → 0', () => {
  assertEquals(performanceRatio(1000, NaN), 0)
})

Deno.test('performanceRatio: negative actualViews → 0', () => {
  assertEquals(performanceRatio(-100, 50), 0)
})

Deno.test('performanceRatio: matching niche expectation → ratio ≈ 1', () => {
  assertAlmostEquals(performanceRatio(778, 778), 1.0, 0.001)
})

Deno.test('performanceRatio: 2x outperformer → ratio = 2', () => {
  assertEquals(performanceRatio(200, 100), 2)
})
