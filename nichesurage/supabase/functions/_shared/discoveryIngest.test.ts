// supabase/functions/_shared/discoveryIngest.test.ts
//
// Deno test runner (Jest ignores supabase/functions per jest.config.ts).
// Run locally: `deno test supabase/functions/_shared/discoveryIngest.test.ts`
// (no net hits - these are pure functions.)
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { dedupCandidates, inferContentType } from './discoveryIngest.ts'
import type { ApifyVideoItem } from './apify.ts'

// Builds a real-shaped ApifyVideoItem (nested channel, numeric views/duration).
// `duration` defaults to 600s (longform) so a test opts into shorts explicitly.
function item(over: {
  channelId?: string
  channelName?: string
  views?: number
  title?: string
  url?: string
  duration?: number
}): ApifyVideoItem {
  return {
    id: 'vid-x',
    title: over.title ?? 'untitled',
    url: over.url ?? 'https://www.youtube.com/watch?v=x',
    duration: over.duration ?? 600,
    views: over.views ?? 0,
    channel: {
      id: over.channelId ?? 'C1',
      name: over.channelName ?? 'Channel One',
      url: 'https://www.youtube.com/channel/' + (over.channelId ?? 'C1'),
    },
  }
}

Deno.test('dedupCandidates: empty input yields empty output', () => {
  assertEquals(dedupCandidates([], new Set()), [])
})

Deno.test('dedupCandidates: groups multi-item channel into one candidate', () => {
  const items = [
    item({ channelId: 'C1', views: 100, title: 'A' }),
    item({ channelId: 'C1', views: 200, title: 'B' }),
    item({ channelId: 'C1', views: 50, title: 'C' }),
  ]
  const result = dedupCandidates(items, new Set())
  assertEquals(result.length, 1)
  assertEquals(result[0].channelId, 'C1')
})

Deno.test('dedupCandidates: best-hit is max views; title from that item', () => {
  const items = [
    item({ channelId: 'C1', views: 100, title: 'low' }),
    item({ channelId: 'C1', views: 900, title: 'top' }),
    item({ channelId: 'C1', views: 300, title: 'mid' }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.bestHitViews, 900)
  assertEquals(cand.bestHitTitle, 'top')
})

Deno.test('dedupCandidates: views tie - first-seen item wins (strict > rule)', () => {
  const items = [
    item({ channelId: 'C1', views: 500, title: 'first' }),
    item({ channelId: 'C1', views: 500, title: 'second' }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.bestHitViews, 500)
  assertEquals(cand.bestHitTitle, 'first')
})

Deno.test('dedupCandidates: existingChannelIds excludes a channel with multiple items', () => {
  const items = [
    item({ channelId: 'C1', views: 100, title: 'c1-a' }),
    item({ channelId: 'C1', views: 200, title: 'c1-b' }),
    item({ channelId: 'C1', views: 300, title: 'c1-c' }),
    item({ channelId: 'C2', views: 50, title: 'c2-a' }),
  ]
  const result = dedupCandidates(items, new Set(['C1']))
  assertEquals(result.length, 1)
  assertEquals(result[0].channelId, 'C2')
})

Deno.test('dedupCandidates: channelName prefers the best-hit item', () => {
  const items = [
    item({ channelId: 'C1', views: 10, channelName: 'Old Name' }),
    item({ channelId: 'C1', views: 999, channelName: 'Best Name' }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.channelName, 'Best Name')
})

Deno.test('dedupCandidates: excludes channels already in existing set', () => {
  const items = [
    item({ channelId: 'C1', views: 100 }),
    item({ channelId: 'C2', views: 100 }),
  ]
  const result = dedupCandidates(items, new Set(['C1']))
  assertEquals(result.length, 1)
  assertEquals(result[0].channelId, 'C2')
})

Deno.test('dedupCandidates: drops items with a falsy channel.id', () => {
  const items = [
    item({ channelId: '', views: 100 }),
    item({ channelId: 'C2', views: 100 }),
  ]
  const result = dedupCandidates(items, new Set())
  assertEquals(result.length, 1)
  assertEquals(result[0].channelId, 'C2')
})

Deno.test('dedupCandidates: drops items with a missing channel object', () => {
  // A `{ noResults: true }`-style placeholder has no `channel` at all.
  const items = [
    { id: 'n', title: '', url: '', duration: 0, views: 0 } as unknown as ApifyVideoItem,
    item({ channelId: 'C2', views: 100 }),
  ]
  const result = dedupCandidates(items, new Set())
  assertEquals(result.length, 1)
  assertEquals(result[0].channelId, 'C2')
})

Deno.test('dedupCandidates: allTitles collects every title for the channel', () => {
  const items = [
    item({ channelId: 'C1', views: 1, title: 'one' }),
    item({ channelId: 'C1', views: 2, title: 'two' }),
    item({ channelId: 'C1', views: 3, title: 'three' }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.allTitles, ['one', 'two', 'three'])
})

Deno.test('dedupCandidates: shortsHitRatio - all short (duration <= 60)', () => {
  const items = [
    item({ channelId: 'C1', views: 1, duration: 30 }),
    item({ channelId: 'C1', views: 2, duration: 60 }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.shortsHitRatio, 1)
})

Deno.test('dedupCandidates: shortsHitRatio - none short (duration > 60)', () => {
  const items = [
    item({ channelId: 'C1', views: 1, duration: 61 }),
    item({ channelId: 'C1', views: 2, duration: 2250 }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.shortsHitRatio, 0)
})

Deno.test('dedupCandidates: shortsHitRatio - mixed = 0.5', () => {
  const items = [
    item({ channelId: 'C1', views: 1, duration: 20 }),
    item({ channelId: 'C1', views: 2, duration: 300 }),
    item({ channelId: 'C1', views: 3, duration: 45 }),
    item({ channelId: 'C1', views: 4, duration: 900 }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.shortsHitRatio, 0.5)
})

Deno.test('dedupCandidates: multiple distinct channels each produce one candidate', () => {
  const items = [
    item({ channelId: 'C1', views: 10 }),
    item({ channelId: 'C2', views: 20 }),
    item({ channelId: 'C1', views: 30 }),
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
