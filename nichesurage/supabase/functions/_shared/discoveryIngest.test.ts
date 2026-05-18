// supabase/functions/_shared/discoveryIngest.test.ts
//
// Deno test runner (Jest ignores supabase/functions per jest.config.ts).
// Run locally: `deno test supabase/functions/_shared/discoveryIngest.test.ts`
// (no net hits - these are pure functions.)
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { dedupCandidates, inferContentType } from './discoveryIngest.ts'
import type { ApifyVideoItem } from './apify.ts'

function item(over: Partial<ApifyVideoItem>): ApifyVideoItem {
  return {
    channelId: 'C1',
    channelName: 'Channel One',
    viewCount: 0,
    title: 'untitled',
    url: 'https://youtube.com/watch?v=x',
    subscriberCount: '10K',
    isShortsEligible: false,
    searchQuery: 'default query',
    ...over,
  }
}

Deno.test('dedupCandidates: empty input yields empty output', () => {
  assertEquals(dedupCandidates([], new Set()), [])
})

Deno.test('dedupCandidates: groups multi-item channel into one candidate', () => {
  const items = [
    item({ channelId: 'C1', viewCount: 100, title: 'A' }),
    item({ channelId: 'C1', viewCount: 200, title: 'B' }),
    item({ channelId: 'C1', viewCount: 50, title: 'C' }),
  ]
  const result = dedupCandidates(items, new Set())
  assertEquals(result.length, 1)
  assertEquals(result[0].channelId, 'C1')
})

Deno.test('dedupCandidates: best-hit is max viewCount; title + searchQuery from that item', () => {
  const items = [
    item({ channelId: 'C1', viewCount: 100, title: 'low', searchQuery: 'q-low' }),
    item({ channelId: 'C1', viewCount: 900, title: 'top', searchQuery: 'q-top' }),
    item({ channelId: 'C1', viewCount: 300, title: 'mid', searchQuery: 'q-mid' }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.bestHitViews, 900)
  assertEquals(cand.bestHitTitle, 'top')
  assertEquals(cand.searchQuery, 'q-top')
})

Deno.test('dedupCandidates: channelName prefers the best-hit item', () => {
  const items = [
    item({ channelId: 'C1', viewCount: 10, channelName: 'Old Name' }),
    item({ channelId: 'C1', viewCount: 999, channelName: 'Best Name' }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.channelName, 'Best Name')
})

Deno.test('dedupCandidates: excludes channels already in existing set', () => {
  const items = [
    item({ channelId: 'C1', viewCount: 100 }),
    item({ channelId: 'C2', viewCount: 100 }),
  ]
  const result = dedupCandidates(items, new Set(['C1']))
  assertEquals(result.length, 1)
  assertEquals(result[0].channelId, 'C2')
})

Deno.test('dedupCandidates: drops items with a falsy channelId', () => {
  const items = [
    item({ channelId: '', viewCount: 100 }),
    item({ channelId: 'C2', viewCount: 100 }),
  ]
  const result = dedupCandidates(items, new Set())
  assertEquals(result.length, 1)
  assertEquals(result[0].channelId, 'C2')
})

Deno.test('dedupCandidates: allTitles collects every title for the channel', () => {
  const items = [
    item({ channelId: 'C1', viewCount: 1, title: 'one' }),
    item({ channelId: 'C1', viewCount: 2, title: 'two' }),
    item({ channelId: 'C1', viewCount: 3, title: 'three' }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.allTitles, ['one', 'two', 'three'])
})

Deno.test('dedupCandidates: shortsHitRatio - all shorts', () => {
  const items = [
    item({ channelId: 'C1', viewCount: 1, isShortsEligible: true }),
    item({ channelId: 'C1', viewCount: 2, isShortsEligible: true }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.shortsHitRatio, 1)
})

Deno.test('dedupCandidates: shortsHitRatio - no shorts', () => {
  const items = [
    item({ channelId: 'C1', viewCount: 1, isShortsEligible: false }),
    item({ channelId: 'C1', viewCount: 2, isShortsEligible: false }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.shortsHitRatio, 0)
})

Deno.test('dedupCandidates: shortsHitRatio - mixed', () => {
  const items = [
    item({ channelId: 'C1', viewCount: 1, isShortsEligible: true }),
    item({ channelId: 'C1', viewCount: 2, isShortsEligible: false }),
    item({ channelId: 'C1', viewCount: 3, isShortsEligible: true }),
    item({ channelId: 'C1', viewCount: 4, isShortsEligible: false }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.shortsHitRatio, 0.5)
})

Deno.test('dedupCandidates: multiple distinct channels each produce one candidate', () => {
  const items = [
    item({ channelId: 'C1', viewCount: 10 }),
    item({ channelId: 'C2', viewCount: 20 }),
    item({ channelId: 'C1', viewCount: 30 }),
  ]
  const result = dedupCandidates(items, new Set())
  assertEquals(result.length, 2)
  const byId = Object.fromEntries(result.map(c => [c.channelId, c]))
  assertEquals(byId['C1'].bestHitViews, 30)
  assertEquals(byId['C2'].bestHitViews, 20)
})

Deno.test('inferContentType: ratio > 0.5 -> shorts', () => {
  assertEquals(inferContentType(0.51), 'shorts')
  assertEquals(inferContentType(1), 'shorts')
})

Deno.test('inferContentType: ratio < 0.5 -> longform', () => {
  assertEquals(inferContentType(0.49), 'longform')
  assertEquals(inferContentType(0), 'longform')
})

Deno.test('inferContentType: exactly 0.5 -> longform (tie rule)', () => {
  assertEquals(inferContentType(0.5), 'longform')
})
