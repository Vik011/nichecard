// supabase/functions/scan/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getChannelStats, getRecentVideos } from '../_shared/youtube.ts'
import {
  computeViews48h,
  computeViewsAvg,
  computeSpikeMultiplier,
  computeEngagementRate,
  computeViralityRating,
  computeOpportunityScore,
  computeHookScore,
  computeCompetitionScore,
} from '../_shared/metrics.ts'
import type { WatchlistChannel } from '../_shared/types.ts'

Deno.serve(async (_req: Request) => {
  try {
    const youtubeKey = Deno.env.get('YOUTUBE_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!youtubeKey) throw new Error('YOUTUBE_API_KEY not set')
    if (!supabaseUrl) throw new Error('SUPABASE_URL not set')
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: channels, error: fetchError } = await supabase
      .from('channels_watchlist')
      .select('*')
      .eq('is_active', true)

    if (fetchError) throw fetchError

    if (!channels || channels.length === 0) {
      return new Response(JSON.stringify({ success: true, scanned: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Batch-fetch channel stats (cheap: 1 unit per 50 channels)
    const channelIds = (channels as WatchlistChannel[]).map(c => c.youtube_channel_id)
    const statsArray = await getChannelStats(youtubeKey, channelIds)
    const statsMap = new Map(statsArray.map(s => [s.channelId, s]))

    let scanned = 0
    const now = new Date().toISOString()

    for (const channel of channels as WatchlistChannel[]) {
      try {
        const stats = statsMap.get(channel.youtube_channel_id)
        if (!stats) continue

        const videos = await getRecentVideos(youtubeKey, stats.uploadsPlaylistId, 20)
        if (videos.length === 0) continue

        const views48h = computeViews48h(videos)
        const viewsAvg = computeViewsAvg(videos)
        const spikeMultiplier = computeSpikeMultiplier(views48h, viewsAvg)
        const mostRecent = videos[0]
        const engagementRate = computeEngagementRate(mostRecent)
        const viralityRating = computeViralityRating(spikeMultiplier)
        const opportunityScore = computeOpportunityScore(
          spikeMultiplier,
          stats.subscriberCount,
          stats.channelCreatedAt,
          channel.content_type
        )

        const maxSubs = channel.content_type === 'shorts' ? 100_000 : 500_000
        const hookScore = channel.content_type === 'shorts' ? computeHookScore(mostRecent) : null
        const competitionScore = channel.content_type === 'longform'
          ? computeCompetitionScore(stats.subscriberCount, maxSubs)
          : null

        const channelCreatedDate = new Date(stats.channelCreatedAt).toISOString().split('T')[0]

        const { error: insertError } = await supabase.from('scan_results').insert({
          youtube_channel_id: channel.youtube_channel_id,
          channel_name: stats.channelName,
          niche_label: channel.niche_label,
          channel_url: `https://www.youtube.com/channel/${channel.youtube_channel_id}`,
          channel_created_at: channelCreatedDate,
          video_count: stats.videoCount,
          subscriber_count: stats.subscriberCount,
          views_48h,
          views_avg: Math.round(viewsAvg),
          spike_multiplier: parseFloat(spikeMultiplier.toFixed(2)),
          engagement_rate: parseFloat(engagementRate.toFixed(4)),
          opportunity_score: opportunityScore,
          virality_rating: viralityRating,
          language: channel.language,
          content_type: channel.content_type,
          hook_score: hookScore !== null ? parseFloat(hookScore.toFixed(2)) : null,
          avg_view_duration_pct: null,
          search_volume: null,
          competition_score: competitionScore,
        })

        if (insertError) {
          console.error(`scan_results insert failed for ${channel.youtube_channel_id}:`, insertError)
        }

        await supabase
          .from('channels_watchlist')
          .update({ last_scanned_at: now })
          .eq('id', channel.id)

        scanned++
      } catch (err) {
        console.error(`Scan failed for channel ${channel.youtube_channel_id}:`, err)
      }
    }

    return new Response(JSON.stringify({ success: true, scanned }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Scan fatal error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
