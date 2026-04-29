// supabase/functions/_shared/youtube.ts
import type { YouTubeChannelData, VideoData } from './types.ts'

const BASE = 'https://www.googleapis.com/youtube/v3'

export async function searchChannelIds(
  apiKey: string,
  params: {
    videoDuration: 'short' | 'long'
    publishedAfter: string
    regionCode: 'US' | 'DE'
    pageToken?: string
  }
): Promise<{ channelIds: string[]; nextPageToken?: string }> {
  const url = new URL(`${BASE}/search`)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('type', 'video')
  url.searchParams.set('videoDuration', params.videoDuration)
  url.searchParams.set('publishedAfter', params.publishedAfter)
  url.searchParams.set('order', 'viewCount')
  url.searchParams.set('regionCode', params.regionCode)
  url.searchParams.set('maxResults', '50')
  if (params.pageToken) url.searchParams.set('pageToken', params.pageToken)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`search.list failed ${res.status}: ${await res.text()}`)
  const data = await res.json()

  const channelIds: string[] = (data.items ?? [])
    .map((item: { snippet?: { channelId?: string } }) => item.snippet?.channelId)
    .filter(Boolean)

  return { channelIds, nextPageToken: data.nextPageToken }
}

export async function getChannelStats(
  apiKey: string,
  channelIds: string[]
): Promise<YouTubeChannelData[]> {
  const results: YouTubeChannelData[] = []

  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50)
    const url = new URL(`${BASE}/channels`)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('part', 'snippet,statistics,contentDetails')
    url.searchParams.set('id', batch.join(','))
    url.searchParams.set('maxResults', '50')

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`channels.list failed ${res.status}: ${await res.text()}`)
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

export async function getRecentVideos(
  apiKey: string,
  uploadsPlaylistId: string,
  maxResults = 20
): Promise<VideoData[]> {
  const playlistUrl = new URL(`${BASE}/playlistItems`)
  playlistUrl.searchParams.set('key', apiKey)
  playlistUrl.searchParams.set('part', 'contentDetails')
  playlistUrl.searchParams.set('playlistId', uploadsPlaylistId)
  playlistUrl.searchParams.set('maxResults', String(maxResults))

  const playlistRes = await fetch(playlistUrl.toString())
  if (!playlistRes.ok) throw new Error(`playlistItems.list failed ${playlistRes.status}: ${await playlistRes.text()}`)
  const playlistData = await playlistRes.json()

  const videoIds: string[] = (playlistData.items ?? [])
    .map((item: { contentDetails?: { videoId?: string } }) => item.contentDetails?.videoId)
    .filter(Boolean)

  if (videoIds.length === 0) return []

  const videosUrl = new URL(`${BASE}/videos`)
  videosUrl.searchParams.set('key', apiKey)
  videosUrl.searchParams.set('part', 'snippet,statistics')
  videosUrl.searchParams.set('id', videoIds.join(','))

  const videosRes = await fetch(videosUrl.toString())
  if (!videosRes.ok) throw new Error(`videos.list failed ${videosRes.status}: ${await videosRes.text()}`)
  const videosData = await videosRes.json()

  return (videosData.items ?? []).map((item: {
    id: string
    snippet: { title: string; publishedAt: string }
    statistics: { viewCount?: string; likeCount?: string; commentCount?: string }
  }) => ({
    videoId: item.id,
    title: item.snippet.title,
    viewCount: parseInt(item.statistics.viewCount ?? '0', 10),
    likeCount: parseInt(item.statistics.likeCount ?? '0', 10),
    commentCount: parseInt(item.statistics.commentCount ?? '0', 10),
    publishedAt: item.snippet.publishedAt,
  })).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
}
