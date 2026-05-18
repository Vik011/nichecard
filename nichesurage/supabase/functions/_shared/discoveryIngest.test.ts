// supabase/functions/_shared/discoveryIngest.test.ts
//
// Deno test runner (Jest ignores supabase/functions per jest.config.ts).
// Run locally: `deno test supabase/functions/_shared/discoveryIngest.test.ts`
// (no net hits - these are pure functions.)
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  dedupCandidates,
  inferContentType,
  parseDurationToSeconds,
} from './discoveryIngest.ts'
import type { ApifyVideoItem } from './apify.ts'

// Builds a real-shaped ApifyVideoItem (flat fields, "HH:MM:SS" duration
// string, numeric viewCount). `duration` defaults to "10:00" (longform) so a
// test opts into shorts explicitly.
function item(over: {
  channelId?: string
  channelName?: string
  viewCount?: number
  title?: string
  url?: string
  duration?: string
  input?: string
}): ApifyVideoItem {
  return {
    id: 'vid-x',
    title: over.title ?? 'untitled',
    url: over.url ?? 'https://www.youtube.com/watch?v=x',
    duration: over.duration ?? '10:00',
    viewCount: over.viewCount ?? 0,
    channelId: over.channelId ?? 'C1',
    channelName: over.channelName ?? 'Channel One',
    numberOfSubscribers: 10000,
    type: 'video',
    input: over.input ?? 'seed query',
  }
}

// --- parseDurationToSeconds -------------------------------------------------

Deno.test('parseDurationToSeconds: HH:MM:SS', () => {
  assertEquals(parseDurationToSeconds('01:41:07'), 6067)
  assertEquals(parseDurationToSeconds('00:21:25'), 1285)
})

Deno.test('parseDurationToSeconds: MM:SS', () => {
  assertEquals(parseDurationToSeconds('21:25'), 1285)
  assertEquals(parseDurationToSeconds('00:45'), 45)
})

Deno.test('parseDurationToSeconds: bare SS', () => {
  assertEquals(parseDurationToSeconds('45'), 45)
  assertEquals(parseDurationToSeconds('0'), 0)
})

Deno.test('parseDurationToSeconds: malformed / empty -> 999999', () => {
  assertEquals(parseDurationToSeconds(''), 999999)
  assertEquals(parseDurationToSeconds('   '), 999999)
  assertEquals(parseDurationToSeconds('abc'), 999999)
  assertEquals(parseDurationToSeconds('1:2:3:4'), 999999)
  assertEquals(parseDurationToSeconds('12:ab'), 999999)
  assertEquals(parseDurationToSeconds('LIVE'), 999999)
  assertEquals(parseDurationToSeconds(undefined as unknown as string), 999999)
})

// --- dedupCandidates --------------------------------------------------------

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

Deno.test('dedupCandidates: best-hit is max viewCount; title from that item', () => {
  const items = [
    item({ channelId: 'C1', viewCount: 100, title: 'low' }),
    item({ channelId: 'C1', viewCount: 900, title: 'top' }),
    item({ channelId: 'C1', viewCount: 300, title: 'mid' }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.bestHitViews, 900)
  assertEquals(cand.bestHitTitle, 'top')
})

Deno.test('dedupCandidates: viewCount tie - first-seen item wins (strict > rule)', () => {
  const items = [
    item({ channelId: 'C1', viewCount: 500, title: 'first' }),
    item({ channelId: 'C1', viewCount: 500, title: 'second' }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.bestHitViews, 500)
  assertEquals(cand.bestHitTitle, 'first')
})

Deno.test('dedupCandidates: searchQuery taken from the best-hit item input', () => {
  const items = [
    item({ channelId: 'C1', viewCount: 100, input: 'low query' }),
    item({ channelId: 'C1', viewCount: 900, input: 'winning query' }),
    item({ channelId: 'C1', viewCount: 300, input: 'mid query' }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.searchQuery, 'winning query')
})

Deno.test('dedupCandidates: existingChannelIds excludes a channel with multiple items', () => {
  const items = [
    item({ channelId: 'C1', viewCount: 100, title: 'c1-a' }),
    item({ channelId: 'C1', viewCount: 200, title: 'c1-b' }),
    item({ channelId: 'C1', viewCount: 300, title: 'c1-c' }),
    item({ channelId: 'C2', viewCount: 50, title: 'c2-a' }),
  ]
  const result = dedupCandidates(items, new Set(['C1']))
  assertEquals(result.length, 1)
  assertEquals(result[0].channelId, 'C2')
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

Deno.test('dedupCandidates: shortsHitRatio - all short (parsed duration <= 60)', () => {
  const items = [
    item({ channelId: 'C1', viewCount: 1, duration: '00:30' }),
    item({ channelId: 'C1', viewCount: 2, duration: '01:00' }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.shortsHitRatio, 1)
})

Deno.test('dedupCandidates: shortsHitRatio - none short (parsed duration > 60)', () => {
  const items = [
    item({ channelId: 'C1', viewCount: 1, duration: '01:01' }),
    item({ channelId: 'C1', viewCount: 2, duration: '00:37:30' }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.shortsHitRatio, 0)
})

Deno.test('dedupCandidates: shortsHitRatio - mixed = 0.5', () => {
  const items = [
    item({ channelId: 'C1', viewCount: 1, duration: '00:20' }),
    item({ channelId: 'C1', viewCount: 2, duration: '05:00' }),
    item({ channelId: 'C1', viewCount: 3, duration: '00:45' }),
    item({ channelId: 'C1', viewCount: 4, duration: '15:00' }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.shortsHitRatio, 0.5)
})

Deno.test('dedupCandidates: shortsHitRatio - malformed duration counts as longform', () => {
  // A malformed duration parses to 999999, so it must NOT count as a Short.
  const items = [
    item({ channelId: 'C1', viewCount: 1, duration: 'LIVE' }),
    item({ channelId: 'C1', viewCount: 2, duration: '00:30' }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.shortsHitRatio, 0.5)
})

Deno.test('dedupCandidates: handles an empty input string on the best-hit item', () => {
  const items = [
    item({ channelId: 'C1', viewCount: 5, input: '' }),
  ]
  const [cand] = dedupCandidates(items, new Set())
  assertEquals(cand.searchQuery, '')
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

// --- inferContentType -------------------------------------------------------

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
