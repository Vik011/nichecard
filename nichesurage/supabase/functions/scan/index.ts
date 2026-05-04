// supabase/functions/scan/index.ts
// Sonar scan: hydrate every watchlisted channel, compute outlier_ratio
// (best video viewCount in window / subscriberCount), and persist a row only
// if ratio >= OUTLIER_DB_FLOOR. Legacy fields (spike_multiplier, opportunity_score)
// kept populated for backward compat with the existing /discover UI.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getChannelStats,
  getRecentVideosWithStats,
  getYoutubeKeys,
} from '../_shared/youtube.ts'
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
import {
  computeVelocityFeatures,
  deriveLifecycleStatus,
} from '../_shared/velocity.ts'
import type {
  WatchlistChannel,
  VideoData,
  VideoSnapshot,
  LifecycleStatus,
} from '../_shared/types.ts'

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
    // Single timestamp for the entire scan run — every snapshot row inserted
    // in this invocation shares it, giving downstream a clean join key.
    const scannedAt = new Date().toISOString()
    const now = scannedAt
    // Sprint B Phase 2: drop videos older than 30 days BEFORE snapshot insert.
    // Avoids ingesting stale channel back-catalog noise on first scan.
    const SNAPSHOT_FRESHNESS_CUTOFF_MS = Date.now() - 30 * 24 * 3600 * 1000

    for (const channel of channels as WatchlistChannel[]) {
      try {
        const stats = statsMap.get(channel.youtube_channel_id)
        if (!stats) continue

        // Enriched fetch — returns VideoSnapshot-shaped objects (no scannedAt).
        // We adapt to VideoData for the legacy metrics path below.
        const enriched = await getRecentVideosWithStats(youtubeKeys, stats.uploadsPlaylistId, 20)
        if (enriched.length === 0) continue
        scanned++

        // ─── Phase 2: append-only video_snapshots ingest ─────────────
        // Filter to fresh videos (last 30d) and insert one row per video,
        // all sharing scannedAt. Best-effort: errors logged, scan proceeds.
        const fresh = enriched.filter(v => {
          const t = new Date(v.publishedAt).getTime()
          return Number.isFinite(t) && t >= SNAPSHOT_FRESHNESS_CUTOFF_MS
        })
        // Tier-aware throttling (Phase 5b). For now we just READ the tier so
        // the structured log captures it; differential cadence comes later.
        const tier = channel.tier ?? null
        if (fresh.length > 0) {
          const snapshotRows = fresh.map(v => ({
            video_id: v.videoId,
            channel_id: v.channelId,
            scanned_at: scannedAt,
            view_count: v.viewCount,
            like_count: v.likeCount,
            comment_count: v.commentCount,
            duration_seconds: v.durationSeconds,
            thumbnail_url: v.thumbnailUrl,
            title: v.title,
            published_at: v.publishedAt,
          }))
          const { error: snapshotErr } = await supabase
            .from('video_snapshots')
            .insert(snapshotRows)
          if (snapshotErr) {
            console.error(
              'scan: snapshot insert failed for channel',
              channel.youtube_channel_id,
              snapshotErr,
            )
            // Do NOT throw — snapshots are best-effort. Legacy scan_results
            // writes proceed below.
          }
        }
        console.log('scan_snapshot', JSON.stringify({
          channelId: channel.youtube_channel_id,
          tier,
          videosFetched: enriched.length,
          snapshotsInserted: fresh.length,
          scannedAt,
        }))

        // ─── Phase 3: derive video_metrics from snapshot history ─────
        // For every video we just snapshotted, fetch its latest 3 snapshots
        // (ONE bulk query for the whole channel — no N+1), compute velocity
        // features + lifecycle, UPSERT into video_metrics. Best-effort:
        // failures logged, scan proceeds. Skipped entirely when no fresh
        // snapshots were inserted this run.
        if (fresh.length > 0) {
          const videoIdsForMetrics = fresh.map(v => v.videoId)
          const { data: snapshotRows, error: snapshotFetchErr } = await supabase
            .from('video_snapshots')
            .select(
              'video_id, channel_id, scanned_at, view_count, like_count, comment_count, duration_seconds, thumbnail_url, title, published_at',
            )
            .in('video_id', videoIdsForMetrics)
            .order('video_id', { ascending: true })
            .order('scanned_at', { ascending: false })

          if (snapshotFetchErr) {
            console.error(
              'scan: video_snapshots bulk fetch failed for channel',
              channel.youtube_channel_id,
              snapshotFetchErr,
            )
          } else if (snapshotRows && snapshotRows.length > 0) {
            // Group rows by video_id, keep only the most recent 3 per video,
            // then reverse to ASC for computeVelocityFeatures.
            type SnapshotRow = {
              video_id: string
              channel_id: string
              scanned_at: string
              view_count: number | string | null
              like_count: number | string | null
              comment_count: number | string | null
              duration_seconds: number | null
              thumbnail_url: string | null
              title: string | null
              published_at: string | null
            }
            const byVideo = new Map<string, SnapshotRow[]>()
            for (const row of snapshotRows as SnapshotRow[]) {
              const existing = byVideo.get(row.video_id)
              if (!existing) {
                byVideo.set(row.video_id, [row])
              } else if (existing.length < 3) {
                existing.push(row)
              }
              // Rows arrive scanned_at DESC, so we naturally collect the
              // newest 3 per video and then ignore the rest.
            }

            const metricsRows: Record<string, unknown>[] = []
            const lifecycleDist: Record<LifecycleStatus, number> = {
              emerging: 0,
              exploding: 0,
              peak: 0,
              saturated: 0,
              dying: 0,
            }

            // Build a quick lookup of the just-fetched VideoData (for
            // viewCount + channelId) keyed by videoId.
            const enrichedByVideoId = new Map(fresh.map(v => [v.videoId, v]))

            for (const v of fresh) {
              const grouped = byVideo.get(v.videoId)
              if (!grouped || grouped.length === 0) {
                console.warn(
                  'scan: no snapshots found for video (race or fetch lag)',
                  v.videoId,
                )
                continue
              }
              // Reverse DESC → ASC for the velocity helper.
              const ascSnapshots: VideoSnapshot[] = [...grouped]
                .reverse()
                .map((row): VideoSnapshot => ({
                  videoId: row.video_id,
                  channelId: row.channel_id,
                  viewCount: Number(row.view_count ?? 0),
                  likeCount: Number(row.like_count ?? 0),
                  commentCount: Number(row.comment_count ?? 0),
                  durationSeconds: row.duration_seconds ?? 0,
                  thumbnailUrl: row.thumbnail_url ?? '',
                  title: row.title ?? '',
                  publishedAt: row.published_at ?? '',
                  scannedAt: row.scanned_at,
                }))

              try {
                const features = computeVelocityFeatures(
                  ascSnapshots,
                  stats.subscriberCount,
                  v.publishedAt,
                )
                // Phase 5 retrofits clusterSize. In Phase 3 no clusters
                // exist yet — pass 0 (saturated rule unreachable but the
                // signature stays stable for the future retrofit).
                const lifecycleStatus = deriveLifecycleStatus(
                  features.hoursSinceUpload,
                  features.velocityDelta,
                  0,
                )
                lifecycleDist[lifecycleStatus]++

                const enrichedRow = enrichedByVideoId.get(v.videoId)
                metricsRows.push({
                  video_id: v.videoId,
                  channel_id: enrichedRow?.channelId ?? channel.youtube_channel_id,
                  category: channel.category ?? null,
                  latest_views: v.viewCount,
                  views_per_hour: features.viewsPerHour,
                  comments_per_hour: features.commentsPerHour,
                  likes_per_hour: features.likesPerHour,
                  velocity_delta: features.velocityDelta,
                  view_acceleration: features.viewAcceleration,
                  breakout_ratio: features.breakoutRatio,
                  // novelty_score, trend_score, topic_tags: NULL — Phase 5/6.
                  lifecycle_status: lifecycleStatus,
                  computed_at: scannedAt,
                })
              } catch (velErr) {
                console.error(
                  'scan: velocity compute failed for video',
                  v.videoId,
                  velErr,
                )
              }
            }

            if (metricsRows.length > 0) {
              const { error: metricsErr } = await supabase
                .from('video_metrics')
                .upsert(metricsRows, { onConflict: 'video_id' })
              if (metricsErr) {
                console.error(
                  'scan: video_metrics upsert failed for channel',
                  channel.youtube_channel_id,
                  metricsErr,
                )
                // non-fatal — continue with next video
              }
            }

            console.log('scan_metrics', JSON.stringify({
              channelId: channel.youtube_channel_id,
              metricsComputed: metricsRows.length,
              scannedAt,
              lifecycleDist,
            }))
          }
        }

        // Adapt enriched rows back to legacy VideoData shape for the existing
        // outlier / metrics path. description is unused in this code path
        // (only consumed by anthropic.ts in cluster-outliers), so '' is safe.
        const videos: VideoData[] = enriched
          .map(v => ({
            videoId: v.videoId,
            title: v.title,
            description: '',
            viewCount: v.viewCount,
            likeCount: v.likeCount,
            commentCount: v.commentCount,
            publishedAt: v.publishedAt,
          }))
          .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

        // Sonar outlier window: 48h Shorts (fast viral cycle),
        // 14d Longform (slower viral half-life — tutorials/podcasts/finance
        // content often peaks 1-2 weeks after upload).
        const windowHours = channel.content_type === 'shorts' ? 48 : 336
        const outlier = findOutlier(videos, stats.subscriberCount, windowHours)
        if (outlier.ratio < OUTLIER_DB_FLOOR) {
          // Below DB floor — drop on the floor (don't pollute scan_results).
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
        })

        if (insertError) {
          console.error(`scan_results insert failed for ${channel.youtube_channel_id}:`, insertError)
          continue
        }
        persisted++

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
