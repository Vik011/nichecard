import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchRecentVideos, YouTubeQuotaError } from '@/lib/youtube/recentVideos'
import type { ChannelVideo } from '@/lib/types'

export const runtime = 'nodejs'
const CACHE_HOURS = 24

export async function GET(_req: Request, { params }: { params: { channelId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const channelId = params.channelId
  if (!channelId.startsWith('UC')) {
    return NextResponse.json({ error: 'Invalid channel id' }, { status: 400 })
  }

  const { data: cached } = await supabase
    .from('channel_recent_videos')
    .select('videos, fetched_at')
    .eq('youtube_channel_id', channelId)
    .maybeSingle()

  const now = Date.now()
  const cacheCutoff = now - CACHE_HOURS * 60 * 60 * 1000
  if (cached && new Date(cached.fetched_at).getTime() > cacheCutoff) {
    return NextResponse.json({ videos: cached.videos as ChannelVideo[], cached: true })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    if (cached) {
      return NextResponse.json({ videos: cached.videos as ChannelVideo[], cached: true, stale: true })
    }
    return NextResponse.json({ error: 'YouTube integration not configured' }, { status: 500 })
  }

  let videos: ChannelVideo[]
  try {
    videos = await fetchRecentVideos(apiKey, channelId, 12)
  } catch (err) {
    if (err instanceof YouTubeQuotaError && cached) {
      return NextResponse.json({ videos: cached.videos as ChannelVideo[], cached: true, stale: true })
    }
    console.error('[channel-videos] fetch failed:', err)
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 502 })
  }

  const serviceClient = createServiceClient()
  const { error: cacheErr } = await serviceClient
    .from('channel_recent_videos')
    .upsert(
      { youtube_channel_id: channelId, videos, fetched_at: new Date().toISOString() },
      { onConflict: 'youtube_channel_id' },
    )
  if (cacheErr) console.error('[channel-videos] cache write failed:', cacheErr)

  return NextResponse.json({ videos, cached: false })
}
