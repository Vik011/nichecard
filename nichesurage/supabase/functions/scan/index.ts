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
import {
  expectedViews,
  performanceRatio,
} from '../_shared/expectedPerformance.ts'
import {
  computeTrendScore,
  type TrendScoreInput,
} from '../_shared/trendScore.ts'
import { CATEGORIES, type CategoryEnum } from '../_shared/categories.ts'
import type {
  WatchlistChannel,
  VideoData,
  VideoSnapshot,
  LifecycleStatus,
} from '../_shared/types.ts'
import { toRecentVideoCache, type ChannelVideoCacheItem } from '../_shared/recentVideosCache.ts'

const OUTLIER_DB_FLOOR = parseFloat(Deno.env.get('OUTLIER_DB_FLOOR') ?? '2')
const OUTLIER_SPIKE_THRESHOLD = parseFloat(Deno.env.get('OUTLIER_SPIKE_THRESHOLD') ?? '5')

// Deterministic batch rotation: each hourly run scans the SCAN_BATCH_SIZE
// least-recently-scanned active channels and advances their last_scanned_at, so
// successive runs rotate through the whole watchlist. Bounds BOTH the Edge
// wall-clock ceiling (~150s) and YouTube quota — a full ~591-channel sweep
// overruns both (~28.6k u/day vs the 10k default). 50/run cycles the ~591
// active channels in ~12h, well within the 24h Recent-Uploads cache TTL.
// Sized to 50, not 100: a deployed batch of 100 only reached ~83 channels
// before the wall-clock cut and skipped the post-loop final cache flush (only
// the chunk-of-50 was written). 50 completes the loop with margin so the final
// flush always runs and every scanned channel is warmed.
const SCAN_BATCH_SIZE = 50

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
      // Rotate the watchlist: take the least-recently-scanned block this run.
      // NULLS FIRST → never-scanned channels are picked up first.
      .order('last_scanned_at', { ascending: true, nullsFirst: true })
      .limit(SCAN_BATCH_SIZE)

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

    // Recent-uploads cache warming (per-scan accumulator). Each channel's
    // already-fetched recent videos are mapped to the ChannelVideo cache shape
    // and flushed into channel_recent_videos, so the niche-detail Recent Uploads
    // grid serves from cache (no live YouTube fetch, no paywall) for every
    // scanned channel. Zero extra YouTube quota — the fetch already happens
    // below for video_snapshots.
    //
    // Flushed in CHUNKS during the loop, not as one batch at the very end: the
    // scan runs near the edge-function wall-clock ceiling (~150s for ~591
    // channels), so a single trailing upsert was being killed before it ran
    // (channel_recent_videos stayed stale with no error log). Chunked flushes
    // write while there is still time budget and give partial coverage even if
    // the run is cut short. Best-effort throughout: a flush failure is logged
    // and never throws / never aborts the scan.
    const RECENT_VIDEO_CACHE_FLUSH_SIZE = 50
    const recentVideoCacheRows: {
      youtube_channel_id: string
      videos: ChannelVideoCacheItem[]
      fetched_at: string
    }[] = []
    const flushRecentVideoCacheRows = async (reason: string): Promise<void> => {
      if (recentVideoCacheRows.length === 0) return
      // Dedupe by channel (last-wins) so ON CONFLICT can't affect a row twice,
      // then clear the buffer immediately (bounded memory; best-effort, no retry).
      const deduped = Array.from(
        new Map(recentVideoCacheRows.map((r) => [r.youtube_channel_id, r])).values(),
      )
      recentVideoCacheRows.length = 0
      try {
        const { error: cacheWarmErr } = await supabase
          .from('channel_recent_videos')
          .upsert(deduped, { onConflict: 'youtube_channel_id' })
        if (cacheWarmErr) {
          console.error('scan: recent-videos cache warm failed', cacheWarmErr)
        } else {
          console.log(
            'scan: recent-videos cache warm flushed',
            JSON.stringify({ reason, count: deduped.length }),
          )
        }
      } catch (warmErr) {
        console.error('scan: recent-videos cache warm threw', warmErr)
      }
    }

    for (const channel of channels as WatchlistChannel[]) {
      try {
        const stats = statsMap.get(channel.youtube_channel_id)
        if (!stats) continue

        // Phase 6: track the max trend_score we compute for this channel
        // this scan run. Used both for the structured `scan_trend` log and
        // for the legacy `scan_results.is_premium` backward-compat flag.
        let maxTrendScoreThisChannel = 0

        // Enriched fetch — returns VideoSnapshot-shaped objects (no scannedAt).
        // We adapt to VideoData for the legacy metrics path below.
        const enriched = await getRecentVideosWithStats(youtubeKeys, stats.uploadsPlaylistId, 20)
        if (enriched.length === 0) continue
        scanned++

        // Warm the Recent Uploads cache for this channel. Pushed here — before
        // the outlier gate — so catalog-only / non-outlier channels (which
        // `continue` before producing a scan_results row) still get cached.
        recentVideoCacheRows.push({
          youtube_channel_id: channel.youtube_channel_id,
          videos: toRecentVideoCache(enriched),
          fetched_at: scannedAt,
        })
        // Flush in chunks DURING the loop so warming completes while there is
        // still wall-clock budget (a single trailing batch was being killed).
        if (recentVideoCacheRows.length >= RECENT_VIDEO_CACHE_FLUSH_SIZE) {
          await flushRecentVideoCacheRows('chunk')
        }

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

        // ─── Catalog fields + rotation cursor update ─────────────────
        // Written before the outlier gate so ALL scanned channels get
        // subscriber_count, video_count, last_upload_at AND last_scanned_at,
        // regardless of whether they produce a scan_results row.
        // last_scanned_at is the batch-rotation cursor: the SELECT above orders
        // by it ASC (nulls first), so advancing it here moves this channel to
        // the back of the queue and the next run picks the next block.
        // max publishedAt via reduce — avoids relying on playlist ordering.
        const latestUploadAt = enriched.reduce(
          (max, v) => v.publishedAt > max ? v.publishedAt : max,
          enriched[0].publishedAt,
        )
        const { error: catalogErr } = await supabase
          .from('channels_watchlist')
          .update({
            subscriber_count: stats.subscriberCount,
            video_count: stats.videoCount,
            last_upload_at: latestUploadAt,
            last_scanned_at: scannedAt,
          })
          .eq('id', channel.id)
        if (catalogErr) {
          console.error('scan: catalog update failed for', channel.youtube_channel_id, catalogErr)
        }

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
            // Phase 6: side-map of transient features needed for trend_score
            // computation but NOT persisted on video_metrics. Keyed by video_id.
            const trendContextByVideo = new Map<string, {
              hoursSinceUpload: number
            }>()
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
                  // trend_score: filled by Phase 6 fourth pass below.
                  // topic_tags: NULL — future phase.
                  lifecycle_status: lifecycleStatus,
                  computed_at: scannedAt,
                })
                // Phase 6: stash hoursSinceUpload (already computed in
                // velocity features) for the trend_score pass that runs
                // after novelty. Avoids re-parsing publishedAt later.
                trendContextByVideo.set(v.videoId, {
                  hoursSinceUpload: features.hoursSinceUpload,
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

            // Phase 6: novelty score per video this scan (defaults to 0 when
            // novelty pass is skipped due to NULL category). Used as input to
            // computeTrendScore in the fourth pass below.
            const noveltyByVideoId = new Map<string, number>()

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
                noveltyByVideoId.set(String(m.video_id), novelty)
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

            // ─── Phase 6: fourth pass — weighted trend_score ──────────
            // For every video_metrics row we just upserted, look up cluster
            // membership, compute trend_score via the weighted formula
            // (vph + delta + accel + cph + perfRatio + novelty + cluster,
            // multiplied by lifecycle factor) and UPDATE the row.
            //
            // Defensive: failures here MUST NOT abort the scan. Wrapped in
            // try/catch like the other Phase 3/5A passes.
            if (metricsRows.length > 0) {
              try {
                // Bulk fetch cluster membership for every video this channel
                // contributed in this scan. ONE query, joined to clusters
                // for video_count.
                const videoIdsForTrend = metricsRows.map(m => String(m.video_id))
                const { data: memberRows, error: memberErr } = await supabase
                  .from('trend_cluster_members')
                  .select('video_id, trend_clusters(video_count)')
                  .in('video_id', videoIdsForTrend)

                if (memberErr) {
                  console.error(
                    'scan: trend_cluster_members fetch failed',
                    channel.youtube_channel_id,
                    memberErr,
                  )
                }

                type MemberRow = {
                  video_id: string
                  trend_clusters: { video_count: number } | { video_count: number }[] | null
                }
                const clusterByVideoId = new Map<string, number>()
                for (const row of (memberRows ?? []) as MemberRow[]) {
                  // Supabase nests joined rows as either object or array
                  // depending on relationship cardinality; handle both.
                  const tc = Array.isArray(row.trend_clusters)
                    ? row.trend_clusters[0]
                    : row.trend_clusters
                  const size = Number(tc?.video_count ?? 0)
                  // If a video belongs to multiple clusters (rare), keep
                  // the largest cluster size — strongest replication signal.
                  const prev = clusterByVideoId.get(row.video_id) ?? 0
                  if (size > prev) clusterByVideoId.set(row.video_id, size)
                }

                // Resolve nicheBaseline for performanceRatio. Reuses the
                // Phase 5A cache when category is known; otherwise 0
                // (expectedViews then floors to 1, perfRatio computes off
                // an unrealistically small expectation — but we wrap with
                // log10 clamp to 2 so the impact is bounded).
                const nicheBaselineForChannel = (isKnownCategory && cat)
                  ? (nicheBaselineCache.get(cat) ?? 0)
                  : 0

                let videosScored = 0
                let clusterMemberships = 0
                for (const m of metricsRows) {
                  const videoId = String(m.video_id)
                  const ctx = trendContextByVideo.get(videoId)
                  if (!ctx) continue

                  const expected = expectedViews(
                    stats.subscriberCount,
                    nicheBaselineForChannel,
                    ctx.hoursSinceUpload,
                  )
                  const perfRatio = performanceRatio(
                    Number(m.latest_views ?? 0),
                    expected,
                  )

                  // `inReplicationCluster = clusterSize > 0` (one map lookup,
                  // and a `video_count=0` row would otherwise inflate the
                  // membership counter while contributing zero to the score).
                  const clusterSize = clusterByVideoId.get(videoId) ?? 0
                  const inReplicationCluster = clusterSize > 0
                  if (inReplicationCluster) clusterMemberships++

                  const trendInput: TrendScoreInput = {
                    viewsPerHour: Number(m.views_per_hour ?? 0),
                    velocityDelta: Number(m.velocity_delta ?? 0),
                    viewAcceleration: Number(m.view_acceleration ?? 0),
                    commentsPerHour: Number(m.comments_per_hour ?? 0),
                    likesPerHour: Number(m.likes_per_hour ?? 0),
                    performanceRatio: perfRatio,
                    noveltyScore: noveltyByVideoId.get(videoId) ?? 0,
                    inReplicationCluster,
                    clusterSize,
                    lifecycleStatus: m.lifecycle_status as LifecycleStatus,
                  }
                  const trendScore = computeTrendScore(trendInput)
                  if (trendScore > maxTrendScoreThisChannel) {
                    maxTrendScoreThisChannel = trendScore
                  }

                  const { error: trendErr } = await supabase
                    .from('video_metrics')
                    .update({ trend_score: trendScore })
                    .eq('video_id', videoId)
                  if (trendErr) {
                    console.error(
                      'scan: trend_score update failed',
                      videoId,
                      trendErr,
                    )
                  } else {
                    videosScored++
                  }
                }

                console.log('scan_trend', JSON.stringify({
                  channelId: channel.youtube_channel_id,
                  videosScored,
                  maxTrendScore: maxTrendScoreThisChannel,
                  isPremiumByTrend: maxTrendScoreThisChannel >= 60,
                  clusterMemberships,
                  scannedAt,
                }))
              } catch (trendErr) {
                console.error(
                  'scan: trend_score pass failed for channel',
                  channel.youtube_channel_id,
                  trendErr,
                )
                // Non-fatal — proceed to legacy scan_results write.
              }
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

        // Phase 6 Step 6.4: legacy backward-compat. The plan specifies
        // setting `scan_results.is_premium = (maxTrendScoreThisChannel >= 60)`
        // ONLY when that column already exists. As of migration 0024 the
        // `scan_results` table has no `is_premium` column — `video_metrics.trend_score`
        // is the new source of truth. The boolean is observable in the
        // `scan_trend` structured log (`isPremiumByTrend` field) so we get
        // the signal in production telemetry without a schema change.
        // TODO(phase-7): drop this comment once /discover migrates fully to
        // trend_score and we deprecate scan_results.

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
      } catch (err) {
        console.error(`Scan failed for channel ${channel.youtube_channel_id}:`, err)
      }
    }

    // Final flush for the remainder (< RECENT_VIDEO_CACHE_FLUSH_SIZE). Correctness
    // no longer depends on reaching here — the chunk flushes above already warmed
    // most channels during the loop; this just catches the tail. Best-effort.
    await flushRecentVideoCacheRows('final')

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
