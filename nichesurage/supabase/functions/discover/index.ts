// supabase/functions/discover/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { searchChannelIds, getChannelStats, getRecentVideos } from '../_shared/youtube.ts'
import { getNicheLabel } from '../_shared/anthropic.ts'

interface Combination {
  contentType: 'shorts' | 'longform'
  language: 'en' | 'de'
  regionCode: 'US' | 'DE'
  videoDuration: 'short' | 'long'
  publishedAfterDays: number
  maxSubscribers: number
  maxAgeMonths: number
}

const COMBINATIONS: Combination[] = [
  { contentType: 'shorts', language: 'en', regionCode: 'US', videoDuration: 'short', publishedAfterDays: 2, maxSubscribers: 100_000, maxAgeMonths: 12 },
  { contentType: 'shorts', language: 'de', regionCode: 'DE', videoDuration: 'short', publishedAfterDays: 2, maxSubscribers: 100_000, maxAgeMonths: 12 },
  { contentType: 'longform', language: 'en', regionCode: 'US', videoDuration: 'long', publishedAfterDays: 7, maxSubscribers: 500_000, maxAgeMonths: 24 },
  { contentType: 'longform', language: 'de', regionCode: 'DE', videoDuration: 'long', publishedAfterDays: 7, maxSubscribers: 500_000, maxAgeMonths: 24 },
]

Deno.serve(async (_req: Request) => {
  try {
    const youtubeKey = Deno.env.get('YOUTUBE_API_KEY')
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!youtubeKey) throw new Error('YOUTUBE_API_KEY not set')
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set')
    if (!supabaseUrl) throw new Error('SUPABASE_URL not set')
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: existing, error: watchlistError } = await supabase
      .from('channels_watchlist')
      .select('youtube_channel_id')
    if (watchlistError) throw watchlistError
    const existingIds = new Set<string>((existing ?? []).map((c: { youtube_channel_id: string }) => c.youtube_channel_id))

    let totalAdded = 0

    for (const combo of COMBINATIONS) {
      try {
        const publishedAfter = new Date(Date.now() - combo.publishedAfterDays * 24 * 60 * 60 * 1000).toISOString()

        // Collect channel IDs across 5 paginated search.list calls
        const channelIdSet = new Set<string>()
        let pageToken: string | undefined
        for (let page = 0; page < 5; page++) {
          const { channelIds, nextPageToken } = await searchChannelIds(youtubeKey, {
            videoDuration: combo.videoDuration,
            publishedAfter,
            regionCode: combo.regionCode,
            pageToken,
          })
          channelIds.forEach(id => channelIdSet.add(id))
          if (!nextPageToken) break
          pageToken = nextPageToken
        }

        const newIds = [...channelIdSet].filter(id => !existingIds.has(id))
        if (newIds.length === 0) continue

        const statsArray = await getChannelStats(youtubeKey, newIds)
        const maxAgeMs = combo.maxAgeMonths * 30 * 24 * 60 * 60 * 1000

        const qualifying = statsArray.filter(ch => {
          const ageMs = Date.now() - new Date(ch.channelCreatedAt).getTime()
          return ch.subscriberCount <= combo.maxSubscribers && ageMs <= maxAgeMs
        })

        for (const channel of qualifying) {
          // Skip if another combination already added this channel in this run
          if (existingIds.has(channel.channelId)) continue

          let nicheLabel = ''
          try {
            const videos = await getRecentVideos(youtubeKey, channel.uploadsPlaylistId, 5)
            const titles = videos.map(v => v.title)
            nicheLabel = await getNicheLabel(anthropicKey, channel.channelName, titles)
          } catch (err) {
            console.error(`Labeling failed for ${channel.channelName}:`, err)
          }

          const { error } = await supabase.from('channels_watchlist').insert({
            youtube_channel_id: channel.channelId,
            channel_name: channel.channelName,
            niche_label: nicheLabel,
            content_type: combo.contentType,
            language: combo.language,
          })

          if (error) {
            if (error.code !== '23505') {
              console.error(`Insert failed for ${channel.channelId}:`, error)
            }
          } else {
            totalAdded++
            existingIds.add(channel.channelId)
          }
        }
      } catch (err) {
        console.error(`Combination ${combo.contentType}/${combo.language} failed:`, err)
      }
    }

    return new Response(JSON.stringify({ success: true, added: totalAdded }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Discover fatal error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
