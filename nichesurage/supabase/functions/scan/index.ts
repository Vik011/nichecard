// supabase/functions/scan/index.ts
//
// Sprint A.8 update — scan now does TWO things per channel:
//
//   1. Legacy outlier_ratio (kept) — feeds Basic-tier /discover so the UI
//      always has content. Persists when ratio ≥ OUTLIER_DB_FLOOR.
//   2. Premium spike check (new) — strict per-format gates from
//      _shared/premiumSpike. Sets is_premium / premium_score / premium_reason
//      etc. Premium signal is independent of legacy ratio: a channel may be
//      premium with a low legacy ratio (we still persist), or have a high
//      legacy ratio but fail premium (we still persist, premium=false).
//
// Also: EN-only filter (DE rows soft-deleted via 0021).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getChannelStats, getRecentVideos, getYoutubeKeys } from '../_shared/youtube.ts'
import {
  computeViews48h,
  computeViewsAvg,
  computeSpikeMultiplier,
  computeEngagementRate,
  computeViralityRating,
  computeOpportunityScore,
  computeHookScore,
  computeCompetitionScore,
  findOutlier,
} from '../_shared/metrics.ts'
import { isPremiumSpikeChannel } from '../_shared/premiumSpike.ts'
import type { WatchlistChannel } from '../_shared/types.ts'

const OUTLIER_DB_FLOOR = parseFloat(Deno.env.get('OUTLIER_DB_FLOOR') ?? '2')
const OUTLIER_SPIKE_THRESHOLD = parseFloat(Deno.env.get('OUTLIER_SPIKE_THRESHOLD') ?? '5')

Deno.serve(async (_req: Request) => {
  try {
    const youtubeKeys = getYoutubeKeys()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl) throw new Error('SUPABASE_URL not set')
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: channels, error: fetchError } = await supabase
      .from('channels_watchlist')
      .select('*')
      .eq('is_active', true)
      // Sprint A.8: scanner is EN-only. DE rows were soft-deleted via 0021.
      .eq('language', 'en')

    if (fetchError) throw fetchError
    if (!channels || channels.length === 0) {
      return new Response(JSON.stringify({ success: true, scanned: 0, persisted: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const channelIds = (channels as WatchlistChannel[]).map(c => c.youtube_channel_id)
    const statsArray = await getChannelStats(youtubeKeys, channelIds)
    const statsMap = new Map(statsArray.map(s => [s.channelId, s]))

    let scanned = 0
    let persisted = 0
    const now = new Date().toISOString()

    for (const channel of channels as WatchlistChannel[]) {
      try {
        const stats = statsMap.get(channel.youtube_channel_id)
        if (!stats) continue

        const videos = await getRecentVideos(youtubeKeys, stats.uploadsPlaylistId, 20)
        if (videos.length === 0) continue
        scanned++

        // Sonar outlier window: 48h Shorts (fast viral cycle),
        // 14d Longform (slower viral half-life — tutorials/podcasts/finance
        // content often peaks 1-2 weeks after upload).
        const windowHours = channel.content_type === 'shorts' ? 48 : 336
        const outlier = findOutlier(videos, stats.subscriberCount, windowHours)

        // Sprint A.8: premium spike check runs in parallel to legacy outlier.
        // We persist if EITHER signal qualifies — legacy ratio above floor OR
        // premium check passed. Premium can pass on a channel whose 48h/14d
        // best-video ratio is low (e.g. a longform channel with consistent
        // 10x VPS across 5 videos but no single jackpot video).
        const premium = isPremiumSpikeChannel(
          {
            contentType: channel.content_type,
            subscriberCount: stats.subscriberCount,
          },
          videos,
        )

        if (outlier.ratio < OUTLIER_DB_FLOOR && !premium.isPremium) {
          // Neither signal qualifies — drop, don't pollute scan_results.
          console.log(JSON.stringify({
            channelId: channel.youtube_channel_id,
            isPremium: false,
            score: premium.score,
            reason: premium.reason || 'below_outlier_floor',
            outlierRatio: outlier.ratio,
          }))
          continue
        }

        // Legacy metrics (kept populated for backward compat).
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

        const isSpike = outlier.ratio >= OUTLIER_SPIKE_THRESHOLD

        const { error: insertError } = await supabase.from('scan_results').insert({
          // Sonar core fields
          outlier_ratio: outlier.ratio,
          is_spike: isSpike,
          outlier_video_id: outlier.video?.videoId ?? null,
          outlier_video_title: outlier.video?.title ?? null,
          outlier_video_views: outlier.video?.viewCount ?? null,
          window_hours: windowHours,
          seed_keyword: channel.seed_keyword,

          // Legacy fields
          youtube_channel_id: channel.youtube_channel_id,
          channel_name: stats.channelName,
          niche_label: channel.niche_label,
          channel_url: `https://www.youtube.com/channel/${channel.youtube_channel_id}`,
          channel_created_at: channelCreatedDate,
          video_count: stats.videoCount,
          subscriber_count: stats.subscriberCount,
          views_48h: views48h,
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

          // Sprint A.8 — premium spike fields.
          is_premium: premium.isPremium,
          premium_score: premium.score,
          premium_reason: premium.reason,
          qualifying_video_count: premium.qualifyingVideoCount,
          vps_recent_avg: premium.vpsRecentAvg,
          vps_older_median: premium.vpsOlderMedian,
          spike_multiplier_recent: premium.spikeMultiplier,
        })

        if (insertError) {
          console.error(`scan_results insert failed for ${channel.youtube_channel_id}:`, insertError)
          continue
        }
        persisted++

        // Audit log so we can read back acceptance rate from edge logs.
        console.log(JSON.stringify({
          channelId: channel.youtube_channel_id,
          isPremium: premium.isPremium,
          score: premium.score,
          reason: premium.reason,
          outlierRatio: outlier.ratio,
        }))

        await supabase
          .from('channels_watchlist')
          .update({ last_scanned_at: now })
          .eq('id', channel.id)
      } catch (err) {
        console.error(`Scan failed for channel ${channel.youtube_channel_id}:`, err)
      }
    }

    return new Response(JSON.stringify({ success: true, scanned, persisted }), {
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
