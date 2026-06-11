// supabase/functions/_shared/recentVideosCache.test.ts
//
// Tests for the recent-uploads cache mapper used by scan cache-warming.
//
// Deno test runner (Jest ignores supabase/functions per jest.config.ts).
// Run locally: `deno test supabase/functions/_shared/recentVideosCache.test.ts`
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { toRecentVideoCache } from './recentVideosCache.ts'

const v = (over: Record<string, unknown> = {}) => ({
  videoId: 'vid1',
  channelId: 'UCxxxx',
  thumbnailUrl: 'https://i.ytimg.com/vi/vid1/hq.jpg',
  title: 'A title',
  viewCount: 100,
  likeCount: 5,
  commentCount: 2,
  durationSeconds: 120,
  publishedAt: '2026-06-01T00:00:00Z',
  ...over,
})

Deno.test('maps videoId→id and thumbnailUrl→thumbnail, preserves title/viewCount/publishedAt', () => {
  const out = toRecentVideoCache([v()])
  assertEquals(out, [{
    id: 'vid1',
    title: 'A title',
    thumbnail: 'https://i.ytimg.com/vi/vid1/hq.jpg',
    viewCount: 100,
    publishedAt: '2026-06-01T00:00:00Z',
  }])
})

Deno.test('drops the renamed/extra fields (channelId, likeCount, etc.)', () => {
  const out = toRecentVideoCache([v()])
  assertEquals(Object.keys(out[0]).sort(), ['id', 'publishedAt', 'thumbnail', 'title', 'viewCount'])
})

Deno.test('sorts newest-first by publishedAt', () => {
  const out = toRecentVideoCache([
    v({ videoId: 'old', publishedAt: '2026-01-01T00:00:00Z' }),
    v({ videoId: 'new', publishedAt: '2026-06-01T00:00:00Z' }),
    v({ videoId: 'mid', publishedAt: '2026-03-01T00:00:00Z' }),
  ])
  assertEquals(out.map((x) => x.id), ['new', 'mid', 'old'])
})

Deno.test('slices to 12 when given more', () => {
  const many = Array.from({ length: 20 }, (_, i) =>
    v({ videoId: `v${i}`, publishedAt: `2026-06-${String(i + 1).padStart(2, '0')}T00:00:00Z` }))
  const out = toRecentVideoCache(many)
  assertEquals(out.length, 12)
  // newest-first → highest day index first
  assertEquals(out[0].id, 'v19')
})

Deno.test('drops entries with missing or empty videoId', () => {
  const out = toRecentVideoCache([
    v({ videoId: 'keep' }),
    v({ videoId: '' }),
    v({ videoId: undefined }),
    v({ videoId: null }),
  ])
  assertEquals(out.map((x) => x.id), ['keep'])
})

Deno.test('coerces non-finite viewCount to 0', () => {
  const out = toRecentVideoCache([
    v({ videoId: 'a', viewCount: NaN }),
    v({ videoId: 'b', viewCount: undefined }),
    v({ videoId: 'c', viewCount: Infinity }),
  ])
  assertEquals(out.map((x) => x.viewCount), [0, 0, 0])
})

Deno.test('defaults missing thumbnail/title/publishedAt to empty string without throwing', () => {
  const out = toRecentVideoCache([
    { videoId: 'partial' },
  ])
  assertEquals(out, [{ id: 'partial', title: '', thumbnail: '', viewCount: 0, publishedAt: '' }])
})

Deno.test('returns [] for empty, null, or undefined input', () => {
  assertEquals(toRecentVideoCache([]), [])
  assertEquals(toRecentVideoCache(null), [])
  assertEquals(toRecentVideoCache(undefined), [])
})
