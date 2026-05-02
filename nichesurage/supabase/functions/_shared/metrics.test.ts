// supabase/functions/_shared/metrics.test.ts
import { assertEquals, assertAlmostEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  computeViews48h,
  computeViewsAvg,
  computeSpikeMultiplier,
  computeEngagementRate,
  computeViralityRating,
  computeOpportunityScore,
  computeHookScore,
  computeCompetitionScore,
  findOutlier,
} from './metrics.ts'
import type { VideoData } from './types.ts'

function makeVideo(overrides: Partial<VideoData> = {}): VideoData {
  return {
    videoId: 'v1',
    title: 'Test',
    description: '',
    viewCount: 1000,
    likeCount: 50,
    commentCount: 10,
    publishedAt: new Date().toISOString(),
    ...overrides,
  }
}

Deno.test('computeViews48h sums views for recent videos only', () => {
  const recent = makeVideo({ viewCount: 5000, publishedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString() })
  const old = makeVideo({ viewCount: 9000, publishedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString() })
  assertEquals(computeViews48h([recent, old]), 5000)
})

Deno.test('computeViews48h returns 0 when no recent videos', () => {
  const old = makeVideo({ viewCount: 9000, publishedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString() })
  assertEquals(computeViews48h([old]), 0)
})

Deno.test('computeViewsAvg returns mean across all videos', () => {
  const videos = [makeVideo({ viewCount: 1000 }), makeVideo({ viewCount: 3000 })]
  assertEquals(computeViewsAvg(videos), 2000)
})

Deno.test('computeViewsAvg returns 0 for empty array', () => {
  assertEquals(computeViewsAvg([]), 0)
})

Deno.test('computeSpikeMultiplier divides views48h by avg', () => {
  assertAlmostEquals(computeSpikeMultiplier(10000, 1000), 10, 0.001)
})

Deno.test('computeSpikeMultiplier caps at 50', () => {
  assertEquals(computeSpikeMultiplier(100000, 1000), 50)
})

Deno.test('computeSpikeMultiplier returns 0 when avg is 0', () => {
  assertEquals(computeSpikeMultiplier(5000, 0), 0)
})

Deno.test('computeEngagementRate sums likes+comments over views', () => {
  const v = makeVideo({ viewCount: 1000, likeCount: 80, commentCount: 20 })
  assertAlmostEquals(computeEngagementRate(v), 0.1, 0.001)
})

Deno.test('computeEngagementRate returns 0 when views is 0', () => {
  assertEquals(computeEngagementRate(makeVideo({ viewCount: 0 })), 0)
})

Deno.test('computeViralityRating returns excellent for >= 10x', () => {
  assertEquals(computeViralityRating(10), 'excellent')
  assertEquals(computeViralityRating(15), 'excellent')
})

Deno.test('computeViralityRating returns good for >= 3x', () => {
  assertEquals(computeViralityRating(3), 'good')
  assertEquals(computeViralityRating(9.9), 'good')
})

Deno.test('computeViralityRating returns average for < 3x', () => {
  assertEquals(computeViralityRating(2.9), 'average')
  assertEquals(computeViralityRating(0), 'average')
})

Deno.test('computeOpportunityScore is 0-100', () => {
  const score = computeOpportunityScore(5, 50000, new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(), 'shorts')
  assertEquals(score >= 0 && score <= 100, true)
})

Deno.test('computeOpportunityScore is higher for newer channel', () => {
  const newChannel = computeOpportunityScore(5, 10000, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), 'shorts')
  const oldChannel = computeOpportunityScore(5, 10000, new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(), 'shorts')
  assertEquals(newChannel > oldChannel, true)
})

Deno.test('computeHookScore returns likes/views * 100', () => {
  const v = makeVideo({ viewCount: 1000, likeCount: 100 })
  assertAlmostEquals(computeHookScore(v)!, 10, 0.001)
})

Deno.test('computeHookScore returns null when views is 0', () => {
  assertEquals(computeHookScore(makeVideo({ viewCount: 0 })), null)
})

Deno.test('computeCompetitionScore is 100 for max_subs', () => {
  assertEquals(computeCompetitionScore(100000, 100000), 100)
})

Deno.test('computeCompetitionScore is 0 for 0 subs', () => {
  assertEquals(computeCompetitionScore(0, 100000), 0)
})

Deno.test('computeCompetitionScore returns 0 when maxSubs is 0', () => {
  assertEquals(computeCompetitionScore(5000, 0), 0)
})

// ── Sonar findOutlier ──
Deno.test('findOutlier returns 0 for empty videos', () => {
  const r = findOutlier([], 1000, 48)
  assertEquals(r.ratio, 0)
  assertEquals(r.video, null)
})

Deno.test('findOutlier picks the highest viewCount video in window', () => {
  const now = Date.now()
  const inWindow = makeVideo({ videoId: 'in1', viewCount: 5000, publishedAt: new Date(now - 12 * 3600 * 1000).toISOString() })
  const winner   = makeVideo({ videoId: 'in2', viewCount: 25000, publishedAt: new Date(now - 24 * 3600 * 1000).toISOString() })
  const stale    = makeVideo({ videoId: 'old', viewCount: 99999, publishedAt: new Date(now - 72 * 3600 * 1000).toISOString() })
  const r = findOutlier([inWindow, winner, stale], 5000, 48)
  assertEquals(r.video?.videoId, 'in2')
  assertEquals(r.ratio, 5)
})

Deno.test('findOutlier ignores videos outside the window', () => {
  const stale = makeVideo({ viewCount: 1_000_000, publishedAt: new Date(Date.now() - 200 * 3600 * 1000).toISOString() })
  const r = findOutlier([stale], 1000, 48)
  assertEquals(r.ratio, 0)
})

Deno.test('findOutlier guards against zero subscribers', () => {
  const v = makeVideo({ viewCount: 1000, publishedAt: new Date().toISOString() })
  const r = findOutlier([v], 0, 48)
  assertEquals(r.ratio, 1000) // (views / max(subs, 1)) → (1000/1)
})
