// supabase/functions/_shared/youtube.test.ts
// Sprint B Phase 2: parseIsoDuration + getRecentVideosWithStats coverage.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { parseIsoDuration, getRecentVideosWithStats, getMostPopularVideos } from './youtube.ts'

// ─── parseIsoDuration ───────────────────────────────────────────────
Deno.test('parseIsoDuration: PT3M → 180', () => assertEquals(parseIsoDuration('PT3M'), 180))
Deno.test('parseIsoDuration: PT45S → 45', () => assertEquals(parseIsoDuration('PT45S'), 45))
Deno.test('parseIsoDuration: PT1H → 3600', () => assertEquals(parseIsoDuration('PT1H'), 3600))
Deno.test('parseIsoDuration: PT1H2M3S → 3723', () => assertEquals(parseIsoDuration('PT1H2M3S'), 3723))
Deno.test('parseIsoDuration: PT4M13S → 253', () => assertEquals(parseIsoDuration('PT4M13S'), 253))
Deno.test('parseIsoDuration: empty → 0', () => assertEquals(parseIsoDuration(''), 0))
Deno.test('parseIsoDuration: null → 0', () => assertEquals(parseIsoDuration(null), 0))
Deno.test('parseIsoDuration: undefined → 0', () => assertEquals(parseIsoDuration(undefined), 0))
Deno.test('parseIsoDuration: garbage → 0', () => assertEquals(parseIsoDuration('garbage'), 0))
Deno.test('parseIsoDuration: P1Y → 0 (year not supported)', () => assertEquals(parseIsoDuration('P1Y'), 0))
Deno.test('parseIsoDuration: P1D → 0 (day not supported)', () => assertEquals(parseIsoDuration('P1D'), 0))

// ─── getRecentVideosWithStats: mocked fetch ─────────────────────────
type FetchInput = Parameters<typeof fetch>[0]

function withMockedFetch(
  responses: Array<{ matchUrl: string | RegExp; body: unknown }>,
  fn: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    const original = globalThis.fetch
    globalThis.fetch = ((input: FetchInput): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const match = responses.find(r =>
        typeof r.matchUrl === 'string' ? url.includes(r.matchUrl) : r.matchUrl.test(url)
      )
      if (!match) {
        return Promise.reject(new Error(`unexpected fetch: ${url}`))
      }
      return Promise.resolve(
        new Response(JSON.stringify(match.body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }) as typeof fetch
    try {
      await fn()
    } finally {
      globalThis.fetch = original
    }
  }
}

Deno.test('getRecentVideosWithStats: returns shaped snapshot rows', withMockedFetch(
  [
    {
      matchUrl: '/playlistItems',
      body: { items: [{ contentDetails: { videoId: 'vid1' } }, { contentDetails: { videoId: 'vid2' } }] },
    },
    {
      matchUrl: '/videos',
      body: {
        items: [
          {
            id: 'vid1',
            snippet: {
              channelId: 'UCabc',
              title: 'First',
              publishedAt: '2026-05-01T00:00:00Z',
              thumbnails: {
                maxres: { url: 'https://maxres.example/vid1.jpg' },
                high: { url: 'https://high.example/vid1.jpg' },
              },
            },
            contentDetails: { duration: 'PT4M13S' },
            statistics: { viewCount: '12345', likeCount: '678', commentCount: '90' },
          },
          {
            id: 'vid2',
            snippet: {
              channelId: 'UCabc',
              title: 'Second',
              publishedAt: '2026-05-02T00:00:00Z',
              thumbnails: { high: { url: 'https://high.example/vid2.jpg' } },
            },
            contentDetails: { duration: 'PT1H2M3S' },
            statistics: { viewCount: '999', likeCount: '11', commentCount: '2' },
          },
        ],
      },
    },
  ],
  async () => {
    const out = await getRecentVideosWithStats(['fake-key'], 'UU_uploads', 20)
    assertEquals(out.length, 2)
    assertEquals(out[0], {
      videoId: 'vid1',
      channelId: 'UCabc',
      viewCount: 12345,
      likeCount: 678,
      commentCount: 90,
      durationSeconds: 253,
      thumbnailUrl: 'https://maxres.example/vid1.jpg', // maxres preferred
      title: 'First',
      publishedAt: '2026-05-01T00:00:00Z',
    })
    assertEquals(out[1].durationSeconds, 3723)
    assertEquals(out[1].thumbnailUrl, 'https://high.example/vid2.jpg') // falls back to high
  }
))

Deno.test('getRecentVideosWithStats: thumbnail fallback chain', withMockedFetch(
  [
    {
      matchUrl: '/playlistItems',
      body: { items: [{ contentDetails: { videoId: 'a' } }, { contentDetails: { videoId: 'b' } }, { contentDetails: { videoId: 'c' } }] },
    },
    {
      matchUrl: '/videos',
      body: {
        items: [
          // medium-only
          {
            id: 'a',
            snippet: { channelId: 'UC1', title: 'A', publishedAt: '2026-01-01T00:00:00Z', thumbnails: { medium: { url: 'med-a' } } },
            contentDetails: { duration: 'PT1M' },
            statistics: { viewCount: '1' },
          },
          // default-only
          {
            id: 'b',
            snippet: { channelId: 'UC1', title: 'B', publishedAt: '2026-01-01T00:00:00Z', thumbnails: { default: { url: 'def-b' } } },
            contentDetails: { duration: 'PT1M' },
            statistics: { viewCount: '1' },
          },
          // no thumbnails at all
          {
            id: 'c',
            snippet: { channelId: 'UC1', title: 'C', publishedAt: '2026-01-01T00:00:00Z' },
            contentDetails: { duration: 'PT1M' },
            statistics: { viewCount: '1' },
          },
        ],
      },
    },
  ],
  async () => {
    const out = await getRecentVideosWithStats(['fake-key'], 'UU_uploads', 20)
    assertEquals(out[0].thumbnailUrl, 'med-a')
    assertEquals(out[1].thumbnailUrl, 'def-b')
    assertEquals(out[2].thumbnailUrl, '')
  }
))

Deno.test('getRecentVideosWithStats: missing fields default safely', withMockedFetch(
  [
    {
      matchUrl: '/playlistItems',
      body: { items: [{ contentDetails: { videoId: 'sparse' } }] },
    },
    {
      matchUrl: '/videos',
      body: {
        items: [
          // no snippet, no contentDetails, no statistics
          { id: 'sparse' },
        ],
      },
    },
  ],
  async () => {
    const out = await getRecentVideosWithStats(['fake-key'], 'UU_uploads', 20)
    assertEquals(out.length, 1)
    assertEquals(out[0], {
      videoId: 'sparse',
      channelId: '',
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      durationSeconds: 0,
      thumbnailUrl: '',
      title: '',
      publishedAt: '',
    })
  }
))

Deno.test('getRecentVideosWithStats: empty playlist returns []', withMockedFetch(
  [
    { matchUrl: '/playlistItems', body: { items: [] } },
  ],
  async () => {
    const out = await getRecentVideosWithStats(['fake-key'], 'UU_uploads', 20)
    assertEquals(out, [])
  }
))

Deno.test('getRecentVideosWithStats: counts coerced to Number from string', withMockedFetch(
  [
    { matchUrl: '/playlistItems', body: { items: [{ contentDetails: { videoId: 'n' } }] } },
    {
      matchUrl: '/videos',
      body: {
        items: [{
          id: 'n',
          snippet: { channelId: 'UC1', title: 'N', publishedAt: '2026-01-01T00:00:00Z', thumbnails: { high: { url: 'h' } } },
          contentDetails: { duration: 'PT2M' },
          statistics: { viewCount: '7777', likeCount: '88', commentCount: '9' },
        }],
      },
    },
  ],
  async () => {
    const [v] = await getRecentVideosWithStats(['fake-key'], 'UU_uploads', 20)
    assertEquals(typeof v.viewCount, 'number')
    assertEquals(v.viewCount, 7777)
    assertEquals(v.likeCount, 88)
    assertEquals(v.commentCount, 9)
  }
))

// ─── getMostPopularVideos: mocked fetch ─────────────────────────────

Deno.test('getMostPopularVideos: returns parsed videos with duration in seconds',
  withMockedFetch(
    [
      {
        matchUrl: '/videos',
        body: {
          items: [
            {
              id: 'vid1',
              snippet: { title: 'Trending Tech', channelId: 'ch1', channelTitle: 'TechChan' },
              statistics: { viewCount: '1000000' },
              contentDetails: { duration: 'PT4M30S' },
            },
            {
              id: 'vid2',
              snippet: { title: 'Trending Short', channelId: 'ch2', channelTitle: 'ShortChan' },
              statistics: { viewCount: '500000' },
              contentDetails: { duration: 'PT45S' },
            },
          ],
        },
      },
    ],
    async () => {
      const videos = await getMostPopularVideos(['fake-key'], {
        videoCategoryId: '28',
        regionCode: 'US',
        maxResults: 50,
      })
      assertEquals(videos.length, 2)
      assertEquals(videos[0].videoId, 'vid1')
      assertEquals(videos[0].channelId, 'ch1')
      assertEquals(videos[0].durationSeconds, 270)
      assertEquals(videos[0].viewCount, 1_000_000)
      assertEquals(videos[1].durationSeconds, 45)
    },
  ),
)

Deno.test('getMostPopularVideos: empty items array returns []',
  withMockedFetch(
    [{ matchUrl: '/videos', body: { items: [] } }],
    async () => {
      const videos = await getMostPopularVideos(['fake-key'], {
        videoCategoryId: '99',
        regionCode: 'US',
        maxResults: 50,
      })
      assertEquals(videos.length, 0)
    },
  ),
)
