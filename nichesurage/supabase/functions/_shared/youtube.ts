// supabase/functions/_shared/youtube.ts
import type { YouTubeChannelData, VideoData, VideoSearchHit } from './types.ts'

const BASE = 'https://www.googleapis.com/youtube/v3'

// Read primary + optional fallback YouTube API key from env.
// Order matters: primary key is tried first; on quota-exceeded (403 + "quota"
// in body) we transparently retry with the secondary key.
export function getYoutubeKeys(): string[] {
  const primary = Deno.env.get('YOUTUBE_API_KEY')
  const secondary = Deno.env.get('YOUTUBE_API_KEY_2')
  if (!primary) throw new Error('YOUTUBE_API_KEY not set')
  return secondary ? [primary, secondary] : [primary]
}

function isQuotaError(status: number, body: string): boolean {
  if (status !== 403) return false
  const lower = body.toLowerCase()
  return lower.includes('quota') || lower.includes('quotaexceeded') || lower.includes('rateLimitExceeded'.toLowerCase())
}

// Generic fetch with key rotation on quota errors.
// `buildUrl(key)` must produce a fresh URL embedding the given key.
// Returns the first successful Response; throws if every key is exhausted.
async function tryFetchWithFallback(
  keys: string[],
  buildUrl: (key: string) => URL,
  endpoint: string
): Promise<Response> {
  let lastErr: Error | null = null
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const res = await fetch(buildUrl(key).toString())
    if (res.ok) return res

    const body = await res.clone().text()
    if (isQuotaError(res.status, body) && i < keys.length - 1) {
      console.warn(`${endpoint}: quota on key #${i + 1}, falling back to key #${i + 2}`)
      lastErr = new Error(`${endpoint} quota on key ${i + 1}: ${body.slice(0, 120)}`)
      continue
    }
    throw new Error(`${endpoint} failed ${res.status}: ${body}`)
  }
  throw lastErr ?? new Error(`${endpoint}: all YouTube API keys exhausted`)
}

export async function searchChannelIds(
  apiKeys: string[],
  params: {
    videoDuration: 'short' | 'long'
    publishedAfter: string
    regionCode: 'US' | 'DE'
    pageToken?: string
  }
): Promise<{ channelIds: string[]; nextPageToken?: string }> {
  const buildUrl = (key: string) => {
    const url = new URL(`${BASE}/search`)
    url.searchParams.set('key', key)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('type', 'video')
    url.searchParams.set('videoDuration', params.videoDuration)
    url.searchParams.set('publishedAfter', params.publishedAfter)
    url.searchParams.set('order', 'viewCount')
    url.searchParams.set('regionCode', params.regionCode)
    url.searchParams.set('maxResults', '50')
    if (params.pageToken) url.searchParams.set('pageToken', params.pageToken)
    return url
  }

  const res = await tryFetchWithFallback(apiKeys, buildUrl, 'search.list')
  const data = await res.json()

  const channelIds: string[] = (data.items ?? [])
    .map((item: { snippet?: { channelId?: string } }) => item.snippet?.channelId)
    .filter(Boolean)

  return { channelIds, nextPageToken: data.nextPageToken }
}

export async function getChannelStats(
  apiKeys: string[],
  channelIds: string[]
): Promise<YouTubeChannelData[]> {
  const results: YouTubeChannelData[] = []

  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50)
    const buildUrl = (key: string) => {
      const url = new URL(`${BASE}/channels`)
      url.searchParams.set('key', key)
      url.searchParams.set('part', 'snippet,statistics,contentDetails')
      url.searchParams.set('id', batch.join(','))
      url.searchParams.set('maxResults', '50')
      return url
    }

    const res = await tryFetchWithFallback(apiKeys, buildUrl, 'channels.list')
    const data = await res.json()

    for (const item of data.items ?? []) {
      results.push({
        channelId: item.id,
        channelName: item.snippet.title,
        subscriberCount: parseInt(item.statistics.subscriberCount ?? '0', 10),
        videoCount: parseInt(item.statistics.videoCount ?? '0', 10),
        channelCreatedAt: item.snippet.publishedAt,
        uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
      })
    }
  }

  return results
}

// Fetch recent uploads via the channel's Uploads playlist.
// Cost: 1u (playlistItems.list) + 1u (videos.list) — vastly cheaper than
// search.list (100u). Used for known channels in channels_watchlist.
export async function getRecentVideos(
  apiKeys: string[],
  uploadsPlaylistId: string,
  maxResults = 20
): Promise<VideoData[]> {
  const buildPlaylistUrl = (key: string) => {
    const url = new URL(`${BASE}/playlistItems`)
    url.searchParams.set('key', key)
    url.searchParams.set('part', 'contentDetails')
    url.searchParams.set('playlistId', uploadsPlaylistId)
    url.searchParams.set('maxResults', String(maxResults))
    return url
  }

  const playlistRes = await tryFetchWithFallback(apiKeys, buildPlaylistUrl, 'playlistItems.list')
  const playlistData = await playlistRes.json()

  const videoIds: string[] = (playlistData.items ?? [])
    .map((item: { contentDetails?: { videoId?: string } }) => item.contentDetails?.videoId)
    .filter(Boolean)

  if (videoIds.length === 0) return []

  const buildVideosUrl = (key: string) => {
    const url = new URL(`${BASE}/videos`)
    url.searchParams.set('key', key)
    url.searchParams.set('part', 'snippet,statistics')
    url.searchParams.set('id', videoIds.join(','))
    return url
  }

  const videosRes = await tryFetchWithFallback(apiKeys, buildVideosUrl, 'videos.list')
  const videosData = await videosRes.json()

  return (videosData.items ?? []).map((item: {
    id: string
    snippet: { title: string; description?: string; publishedAt: string }
    statistics: { viewCount?: string; likeCount?: string; commentCount?: string }
  }) => ({
    videoId: item.id,
    title: item.snippet.title,
    description: (item.snippet.description ?? '').slice(0, 240),
    viewCount: parseInt(item.statistics.viewCount ?? '0', 10),
    likeCount: parseInt(item.statistics.likeCount ?? '0', 10),
    commentCount: parseInt(item.statistics.commentCount ?? '0', 10),
    publishedAt: item.snippet.publishedAt,
  })).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
}

// Sonar: keyword-driven search returning videos + their channelIds.
// Used by sonar-discover to find outlier candidates by seed term.
export async function searchVideosByKeyword(
  apiKeys: string[],
  params: {
    q: string
    publishedAfter: string
    videoDuration: 'short' | 'medium' | 'long' | 'any'
    regionCode?: 'US' | 'DE'
    maxResults?: number
  }
): Promise<VideoSearchHit[]> {
  const buildUrl = (key: string) => {
    const url = new URL(`${BASE}/search`)
    url.searchParams.set('key', key)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('type', 'video')
    url.searchParams.set('q', params.q)
    url.searchParams.set('videoDuration', params.videoDuration)
    url.searchParams.set('publishedAfter', params.publishedAfter)
    url.searchParams.set('order', 'viewCount')
    if (params.regionCode) url.searchParams.set('regionCode', params.regionCode)
    url.searchParams.set('maxResults', String(params.maxResults ?? 25))
    return url
  }

  const res = await tryFetchWithFallback(apiKeys, buildUrl, 'search.list (sonar)')
  const data = await res.json()

  return (data.items ?? [])
    .filter((item: { id?: { videoId?: string }; snippet?: { channelId?: string } }) =>
      item.id?.videoId && item.snippet?.channelId
    )
    .map((item: {
      id: { videoId: string }
      snippet: { channelId: string; title: string; publishedAt: string }
    }): VideoSearchHit => ({
      videoId: item.id.videoId,
      channelId: item.snippet.channelId,
      title: item.snippet.title,
      publishedAt: item.snippet.publishedAt,
    }))
}
