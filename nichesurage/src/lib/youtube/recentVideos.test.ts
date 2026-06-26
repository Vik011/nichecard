/**
 * @jest-environment node
 */
import { fetchRecentVideos } from './recentVideos'

// Helper: build a Response-like object for the mocked fetch.
function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response
}

describe('fetchRecentVideos — partial YouTube response handling', () => {
  afterEach(() => jest.restoreAllMocks())

  it('skips items missing snippet/statistics instead of throwing', async () => {
    const fetchMock = jest.spyOn(global, 'fetch')
    // 1) channels.list → uploads playlist id
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU_uploads' } } }] }),
    )
    // 2) playlistItems.list → video ids
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          { contentDetails: { videoId: 'good1' } },
          { contentDetails: { videoId: 'nosnippet' } },
          { contentDetails: { videoId: 'good2' } },
        ],
      }),
    )
    // 3) videos.list → one well-formed, one missing snippet, one missing statistics
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: 'good1',
            snippet: { title: 'A', publishedAt: '2026-06-01T00:00:00Z', thumbnails: { high: { url: 'a.jpg' } } },
            statistics: { viewCount: '100' },
          },
          // partial: no snippet at all → must be skipped, not throw
          { id: 'nosnippet', statistics: { viewCount: '999' } },
          // partial: snippet present but no statistics → kept, viewCount defaults to 0
          {
            id: 'good2',
            snippet: { title: 'B', publishedAt: '2026-06-02T00:00:00Z', thumbnails: {} },
          },
        ],
      }),
    )

    const result = await fetchRecentVideos('FAKE_KEY', 'UCxxxx', 12)

    expect(result.map((v) => v.id)).toEqual(['good2', 'good1']) // sorted publishedAt desc
    const good2 = result.find((v) => v.id === 'good2')!
    expect(good2.viewCount).toBe(0) // missing statistics → 0, not a throw
    expect(good2.thumbnail).toBe('') // no thumbnails → empty string
  })

  it('returns [] when the channel has no uploads playlist', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(jsonResponse({ items: [] }))
    await expect(fetchRecentVideos('FAKE_KEY', 'UCxxxx')).resolves.toEqual([])
  })
})
