import type { ChannelVideo } from '@/lib/types'

const BASE = 'https://www.googleapis.com/youtube/v3'

export class YouTubeQuotaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'YouTubeQuotaError'
  }
}

interface ChannelsListItem {
  contentDetails?: { relatedPlaylists?: { uploads?: string } }
}

interface PlaylistItemsItem {
  contentDetails?: { videoId?: string }
}

interface VideosListItem {
  id: string
  snippet: {
    title: string
    publishedAt: string
    thumbnails: {
      high?: { url: string }
      medium?: { url: string }
      default?: { url: string }
    }
  }
  statistics: { viewCount?: string }
}

async function ytFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (res.status === 403) {
    const body = await res.text()
    throw new YouTubeQuotaError(`YouTube quota exceeded or forbidden: ${body.slice(0, 200)}`)
  }
  if (!res.ok) {
    throw new Error(`YouTube API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

export async function fetchRecentVideos(
  apiKey: string,
  youtubeChannelId: string,
  max = 12,
): Promise<ChannelVideo[]> {
  const channelsUrl = new URL(`${BASE}/channels`)
  channelsUrl.searchParams.set('key', apiKey)
  channelsUrl.searchParams.set('part', 'contentDetails')
  channelsUrl.searchParams.set('id', youtubeChannelId)
  const channelsData = await ytFetch<{ items?: ChannelsListItem[] }>(channelsUrl.toString())
  const uploadsId = channelsData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploadsId) return []

  const playlistUrl = new URL(`${BASE}/playlistItems`)
  playlistUrl.searchParams.set('key', apiKey)
  playlistUrl.searchParams.set('part', 'contentDetails')
  playlistUrl.searchParams.set('playlistId', uploadsId)
  playlistUrl.searchParams.set('maxResults', String(max))
  const playlistData = await ytFetch<{ items?: PlaylistItemsItem[] }>(playlistUrl.toString())
  const videoIds: string[] = (playlistData.items ?? [])
    .map(it => it.contentDetails?.videoId)
    .filter((v): v is string => Boolean(v))
  if (videoIds.length === 0) return []

  const videosUrl = new URL(`${BASE}/videos`)
  videosUrl.searchParams.set('key', apiKey)
  videosUrl.searchParams.set('part', 'snippet,statistics')
  videosUrl.searchParams.set('id', videoIds.join(','))
  const videosData = await ytFetch<{ items?: VideosListItem[] }>(videosUrl.toString())

  return (videosData.items ?? [])
    .map(it => ({
      id: it.id,
      title: it.snippet.title,
      thumbnail:
        it.snippet.thumbnails.high?.url ??
        it.snippet.thumbnails.medium?.url ??
        it.snippet.thumbnails.default?.url ??
        '',
      viewCount: parseInt(it.statistics.viewCount ?? '0', 10),
      publishedAt: it.snippet.publishedAt,
    }))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
}
