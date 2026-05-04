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
import {
  computeChannelBaseline,
  computeNicheBaseline,
  computeNoveltyScore,
} from '../_shared/baseline.ts'
import { CATEGORIES, type CategoryEnum } from '../_shared/categories.ts'
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

    // ─── Phase 5A: per-scan baseline caches ──────────────────────────
    // Niche baselines depend only on category and the rolling 30d window;
    // computing them once per scan and reusing across all videos in that
    // category keeps a 100-channel scan to ≤12 niche queries (one per
    // CategoryEnum), not N (one per channel).
    // Channel baselines are scoped to one channel; cached so multiple
    // videos from the same channel in this scan share the lookup.
    const nicheBaselineCache = new Map<CategoryEnum, number>()
    const channelBaselineCache = new Map<string, number>()
    // 1.5× channel-baseline filter: if a video's current vps is below this
    // multiple of its channel's historical median, it's "matching channel
    // norms" — not novel even if niche-relative scoring says otherwise.
    // Caller-side filter per spec; computeNoveltyScore stays niche-relative.
    const CHANNEL_HISTORICAL_FACTOR = 1.5

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
                  // novelty_score: filled by Phase 5A third pass below.
                  // trend_score, topic_tags: NULL — Phase 6.
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

            // ─── Phase 5A: third pass — baseline subtraction → novelty ──
            // For every metrics row we just upserted, compute novelty_score
            // as a niche-relative multiplier and write it back.
            //
            // Skipped entirely when channel.category is NULL (Phase 1
            // recategorize backfill incomplete) — a NULL category can't be
            // baseline-compared and we'd rather store NULL novelty than a
            // misleading number. The per-niche baseline is cached across
            // channels (one query per CategoryEnum per scan run); the
            // per-channel baseline is cached per channel (videos from the
            // same channel reuse it).
            const cat = channel.category as CategoryEnum | null | undefined
            const isKnownCategory = typeof cat === 'string'
              && (CATEGORIES as readonly string[]).includes(cat)

            if (isKnownCategory && metricsRows.length > 0) {
              const category = cat as CategoryEnum
              let nicheBaseline = nicheBaselineCache.get(category)
              if (nicheBaseline === undefined) {
                nicheBaseline = await computeNicheBaseline(supabase, category, 30)
                nicheBaselineCache.set(category, nicheBaseline)
              }
              let channelBaseline = channelBaselineCache.get(channel.youtube_channel_id)
              if (channelBaseline === undefined) {
                channelBaseline = await computeChannelBaseline(
                  supabase,
                  channel.youtube_channel_id,
                  30,
                )
                channelBaselineCache.set(channel.youtube_channel_id, channelBaseline)
              }

              const noveltyRows: Array<{ video_id: string; novelty_score: number }> = []
              for (const m of metricsRows) {
                const currentVps = Number(m.views_per_hour ?? 0)
                const rawNovelty = computeNoveltyScore(
                  currentVps,
                  channelBaseline,
                  nicheBaseline,
                )
                // 1.5× channel-baseline filter (caller-side per spec): if
                // the video isn't outpacing the channel's own historical
                // median by 1.5×, it's just normal performance — collapse
                // novelty to 0 even if niche-relative score is positive.
                const passesChannelFilter = channelBaseline <= 0
                  || currentVps >= CHANNEL_HISTORICAL_FACTOR * channelBaseline
                const novelty = passesChannelFilter ? rawNovelty : 0
                noveltyRows.push({
                  video_id: String(m.video_id),
                  novelty_score: novelty,
                })
              }

              // Write novelty_score per video. Upsert keeps idempotency.
              for (const row of noveltyRows) {
                const { error: noveltyErr } = await supabase
                  .from('video_metrics')
                  .update({ novelty_score: row.novelty_score })
                  .eq('video_id', row.video_id)
                if (noveltyErr) {
                  console.error(
                    'scan: novelty_score update failed',
                    row.video_id,
                    noveltyErr,
                  )
                }
              }

              console.log('scan_novelty', JSON.stringify({
                channelId: channel.youtube_channel_id,
                category,
                channelBaseline,
                nicheBaseline,
                videosScored: noveltyRows.length,
                scannedAt,
              }))
            } else if (metricsRows.length > 0) {
              // NULL category — leave novelty_score NULL. Documented choice:
              // NULL > 0 because 0 falsely implies "computed and matches
              // niche". A future recategorize backfill will fill these in.
              console.log('scan_novelty_skipped', JSON.stringify({
                channelId: channel.youtube_channel_id,
                reason: 'null_category',
                videos: metricsRows.length,
                scannedAt,
              }))
            }
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
