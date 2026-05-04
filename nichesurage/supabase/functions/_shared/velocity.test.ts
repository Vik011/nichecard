// supabase/functions/_shared/velocity.test.ts
//
// Sprint B Phase 3: pure-function tests for computeVelocityFeatures and
// deriveLifecycleStatus.
//
// Deno test runner (Jest ignores supabase/functions per jest.config.ts).
// Run locally: `deno test supabase/functions/_shared/velocity.test.ts`
import {
  assertAlmostEquals,
  assertEquals,
  assertThrows,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { computeVelocityFeatures, deriveLifecycleStatus } from './velocity.ts'
import type { VideoSnapshot } from './types.ts'

function snap(overrides: Partial<VideoSnapshot> = {}): VideoSnapshot {
  return {
    videoId: 'v1',
    channelId: 'c1',
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    durationSeconds: 60,
    thumbnailUrl: '',
    title: 't',
    publishedAt: '2025-01-01T00:00:00Z',
    scannedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

// ─── computeVelocityFeatures ────────────────────────────────────────

Deno.test('velocity: single snapshot, 1k views, 2h since upload, 0 subs', () => {
  const published = '2025-01-01T00:00:00Z'
  const scanned = '2025-01-01T02:00:00Z'
  const f = computeVelocityFeatures(
    [snap({ viewCount: 1000, scannedAt: scanned, publishedAt: published })],
    0,
    published,
  )
  assertAlmostEquals(f.viewsPerHour, 500, 0.001)
  assertAlmostEquals(f.velocityDelta, 1.0, 0.001)
  assertEquals(f.viewAcceleration, 0)
  // 0 subs → denom clamped to 100, so 1000/100 = 10
  assertAlmostEquals(f.breakoutRatio, 10, 0.001)
  assertAlmostEquals(f.hoursSinceUpload, 2, 0.001)
})

Deno.test('velocity: two snapshots, prior vs latest segment ratio = 4.0', () => {
  // publishedAt 1h before T0; T0 → T1 is 1h apart.
  // prior segment vph = 1000 / 1 = 1000
  // latest segment vph = (5000 - 1000) / 1 = 4000
  // velocityDelta = 4000 / 1000 = 4.0
  const published = '2025-01-01T00:00:00Z'
  const t0 = '2025-01-01T01:00:00Z'
  const t1 = '2025-01-01T02:00:00Z'
  const f = computeVelocityFeatures(
    [
      snap({ viewCount: 1000, scannedAt: t0, publishedAt: published }),
      snap({ viewCount: 5000, scannedAt: t1, publishedAt: published }),
    ],
    1000, // 1k subs → breakoutRatio = 5000/1000 = 5
    published,
  )
  assertAlmostEquals(f.velocityDelta, 4.0, 0.001)
  assertEquals(f.viewAcceleration, 0)
  assertAlmostEquals(f.breakoutRatio, 5, 0.001)
})

Deno.test('velocity: three snapshots exploding — delta=11.25, accel=+41000', () => {
  // 1k @ T0, 5k @ T1 (1h later), 50k @ T2 (1h later).
  // vel1 = (5000-1000)/1 = 4000
  // vel2 = (50000-5000)/1 = 45000
  // velocityDelta = 45000/4000 = 11.25
  // acceleration = (45000-4000)/1 = 41000
  const published = '2025-01-01T00:00:00Z'
  const t0 = '2025-01-01T01:00:00Z'
  const t1 = '2025-01-01T02:00:00Z'
  const t2 = '2025-01-01T03:00:00Z'
  const f = computeVelocityFeatures(
    [
      snap({ viewCount: 1000, scannedAt: t0, publishedAt: published }),
      snap({ viewCount: 5000, scannedAt: t1, publishedAt: published }),
      snap({ viewCount: 50000, scannedAt: t2, publishedAt: published }),
    ],
    10000,
    published,
  )
  assertAlmostEquals(f.velocityDelta, 11.25, 0.001)
  assertAlmostEquals(f.viewAcceleration, 41000, 0.001)
})

Deno.test('velocity: three snapshots cooling — delta≈0.10, accel=-44000', () => {
  // 1k @ T0, 50k @ T1 (1h later), 55k @ T2 (1h later).
  // vel1 = (50000-1000)/1 = 49000
  // vel2 = (55000-50000)/1 = 5000
  // velocityDelta = 5000/49000 ≈ 0.10204
  // acceleration = (5000-49000)/1 = -44000
  const published = '2025-01-01T00:00:00Z'
  const t0 = '2025-01-01T01:00:00Z'
  const t1 = '2025-01-01T02:00:00Z'
  const t2 = '2025-01-01T03:00:00Z'
  const f = computeVelocityFeatures(
    [
      snap({ viewCount: 1000, scannedAt: t0, publishedAt: published }),
      snap({ viewCount: 50000, scannedAt: t1, publishedAt: published }),
      snap({ viewCount: 55000, scannedAt: t2, publishedAt: published }),
    ],
    10000,
    published,
  )
  assertAlmostEquals(f.velocityDelta, 5000 / 49000, 0.001)
  assertAlmostEquals(f.viewAcceleration, -44000, 0.001)
})

Deno.test('velocity: zero subs → breakoutRatio uses 100 denom', () => {
  const published = '2025-01-01T00:00:00Z'
  const scanned = '2025-01-01T02:00:00Z'
  const f = computeVelocityFeatures(
    [snap({ viewCount: 5000, scannedAt: scanned, publishedAt: published })],
    0,
    published,
  )
  assertAlmostEquals(f.breakoutRatio, 50, 0.001)
})

Deno.test('velocity: negative subs (defensive) → breakoutRatio uses 100 denom', () => {
  const published = '2025-01-01T00:00:00Z'
  const scanned = '2025-01-01T02:00:00Z'
  const f = computeVelocityFeatures(
    [snap({ viewCount: 5000, scannedAt: scanned, publishedAt: published })],
    -100,
    published,
  )
  assertAlmostEquals(f.breakoutRatio, 50, 0.001)
})

Deno.test('velocity: empty snapshots throws', () => {
  assertThrows(
    () => computeVelocityFeatures([], 1000, '2025-01-01T00:00:00Z'),
    Error,
    'snapshots required',
  )
})

Deno.test('velocity: future-dated publishedAt → hoursSinceUpload clamped, no NaN', () => {
  // publishedAt is AFTER scannedAt — impossible in real life but defensive.
  const published = '2025-01-02T00:00:00Z'
  const scanned = '2025-01-01T00:00:00Z'
  const f = computeVelocityFeatures(
    [snap({ viewCount: 1000, scannedAt: scanned, publishedAt: published })],
    1000,
    published,
  )
  assertAlmostEquals(f.hoursSinceUpload, 0.1, 0.001)
  assertEquals(Number.isFinite(f.viewsPerHour), true)
  assertEquals(Number.isFinite(f.velocityDelta), true)
  assertEquals(Number.isFinite(f.breakoutRatio), true)
})

Deno.test('velocity: invalid publishedAt → hoursSinceUpload defaults to 1, no NaN', () => {
  const scanned = '2025-01-01T05:00:00Z'
  const f = computeVelocityFeatures(
    [snap({ viewCount: 1000, scannedAt: scanned, publishedAt: '' })],
    1000,
    '',
  )
  assertEquals(f.hoursSinceUpload, 1)
  assertEquals(Number.isFinite(f.viewsPerHour), true)
  assertAlmostEquals(f.viewsPerHour, 1000, 0.001)
})

Deno.test('velocity: comments/likes per hour mirror views pattern', () => {
  const published = '2025-01-01T00:00:00Z'
  const scanned = '2025-01-01T02:00:00Z'
  const f = computeVelocityFeatures(
    [snap({
      viewCount: 1000,
      likeCount: 200,
      commentCount: 40,
      scannedAt: scanned,
      publishedAt: published,
    })],
    1000,
    published,
  )
  assertAlmostEquals(f.viewsPerHour, 500, 0.001)
  assertAlmostEquals(f.likesPerHour, 100, 0.001)
  assertAlmostEquals(f.commentsPerHour, 20, 0.001)
})

Deno.test('velocity: negative views (defensive) clamped to 0', () => {
  const published = '2025-01-01T00:00:00Z'
  const scanned = '2025-01-01T02:00:00Z'
  const f = computeVelocityFeatures(
    [snap({ viewCount: -50, scannedAt: scanned, publishedAt: published })],
    1000,
    published,
  )
  assertEquals(f.viewsPerHour, 0)
  assertEquals(f.breakoutRatio, 0)
})

Deno.test('velocity: out-of-order snapshots — caller is responsible (documented precondition)', () => {
  // Caller MUST sort ASC by scannedAt. We trust that contract; if violated
  // the function still produces a finite result (no NaN, no throw) but the
  // segment definitions become meaningless. This test pins down current
  // behavior: it does not throw.
  const published = '2025-01-01T00:00:00Z'
  const t0 = '2025-01-01T01:00:00Z'
  const t1 = '2025-01-01T02:00:00Z'
  const t2 = '2025-01-01T03:00:00Z'
  // Intentionally out of order: T2, T0, T1.
  const f = computeVelocityFeatures(
    [
      snap({ viewCount: 50000, scannedAt: t2, publishedAt: published }),
      snap({ viewCount: 1000, scannedAt: t0, publishedAt: published }),
      snap({ viewCount: 5000, scannedAt: t1, publishedAt: published }),
    ],
    10000,
    published,
  )
  assertEquals(Number.isFinite(f.velocityDelta), true)
  assertEquals(Number.isFinite(f.viewAcceleration), true)
  assertEquals(Number.isFinite(f.viewsPerHour), true)
})

Deno.test('velocity: 4+ snapshots — uses last three only', () => {
  // First snapshot is wildly different from the last three; the function
  // should ignore it because we only consider the LAST three.
  const published = '2025-01-01T00:00:00Z'
  const tOld = '2025-01-01T00:30:00Z'
  const t0 = '2025-01-01T01:00:00Z'
  const t1 = '2025-01-01T02:00:00Z'
  const t2 = '2025-01-01T03:00:00Z'
  const f = computeVelocityFeatures(
    [
      snap({ viewCount: 999_999_999, scannedAt: tOld, publishedAt: published }),
      snap({ viewCount: 1000, scannedAt: t0, publishedAt: published }),
      snap({ viewCount: 5000, scannedAt: t1, publishedAt: published }),
      snap({ viewCount: 50000, scannedAt: t2, publishedAt: published }),
    ],
    10000,
    published,
  )
  // Same as the 3-snapshot exploding test
  assertAlmostEquals(f.velocityDelta, 11.25, 0.001)
  assertAlmostEquals(f.viewAcceleration, 41000, 0.001)
})

// ─── deriveLifecycleStatus ──────────────────────────────────────────

Deno.test('lifecycle: age=12h delta=2.0 cluster=0 → emerging', () => {
  assertEquals(deriveLifecycleStatus(12, 2.0, 0), 'emerging')
})

Deno.test('lifecycle: age=48h delta=1.8 cluster=0 → exploding', () => {
  assertEquals(deriveLifecycleStatus(48, 1.8, 0), 'exploding')
})

Deno.test('lifecycle: age=120h delta=1.0 cluster=0 → peak', () => {
  assertEquals(deriveLifecycleStatus(120, 1.0, 0), 'peak')
})

Deno.test('lifecycle: age=120h delta=0.6 cluster=30 → saturated', () => {
  assertEquals(deriveLifecycleStatus(120, 0.6, 30), 'saturated')
})

Deno.test('lifecycle: age=120h delta=0.6 cluster=0 → peak (clusterSize gate fails)', () => {
  // delta=0.6 is NOT < 0.5 (so dying rule fails) and clusterSize=0 (saturated
  // gate fails) — so falls through to default 'peak'.
  assertEquals(deriveLifecycleStatus(120, 0.6, 0), 'peak')
})

Deno.test('lifecycle: age=240h delta=0.3 cluster=0 → dying', () => {
  assertEquals(deriveLifecycleStatus(240, 0.3, 0), 'dying')
})

Deno.test('lifecycle: age=24h delta=1.5 (boundary) → NOT emerging (rule is >1.5)', () => {
  // age<24 fails (24 is not <24), and delta=1.5 is not >1.5.
  // Falls through; delta=1.5 is not in [0.8,1.2], not <0.5, no cluster → 'peak'.
  assertEquals(deriveLifecycleStatus(24, 1.5, 0), 'peak')
})

Deno.test('lifecycle: age=23.99h delta=1.51 cluster=0 → emerging', () => {
  assertEquals(deriveLifecycleStatus(23.99, 1.51, 0), 'emerging')
})

Deno.test('lifecycle: age=72h delta=1.5 (boundary, second rule) → NOT exploding', () => {
  // age<72 fails (72 not <72), delta=1.5 not >1.5. Falls through. Not in
  // peak window because age=72 not <168? It IS <168. delta=1.5 not in
  // [0.8,1.2]. Default 'peak'.
  assertEquals(deriveLifecycleStatus(72, 1.5, 0), 'peak')
})

Deno.test('lifecycle: negative delta (defensive) → dying', () => {
  // delta < 0.5 catches it.
  assertEquals(deriveLifecycleStatus(240, -1, 0), 'dying')
})
