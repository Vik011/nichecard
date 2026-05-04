import { createClient } from '@/lib/supabase/client'
import type { TrendData, TrendLifecycle } from '@/lib/types/trend'

// Hot window: only consider videos scanned within the last 7 days. Same
// window the /discover hot mode is intended to show. Phase 9 may tune.
const HOT_WINDOW_DAYS = 7

/**
 * Fetch per-channel TrendData for a set of youtube_channel_ids.
 *
 * Joins video_metrics → trend_cluster_members → trend_clusters →
 * narrative_archetypes, picking the row with the highest trend_score
 * per channel and the largest cluster the channel participates in.
 *
 * Returns an empty map for unknown ids. Returns an empty map on any
 * error (logs to console; never throws — UI must degrade silently).
 */
export async function fetchTrendingByChannel(
  youtubeChannelIds: string[],
): Promise<Map<string, TrendData>> {
  if (youtubeChannelIds.length === 0) return new Map()
  const supabase = createClient()

  const sevenDaysAgoIso = new Date(Date.now() - HOT_WINDOW_DAYS * 24 * 3600 * 1000).toISOString()

  // ONE bulk query per surface to avoid N+1 — pull all relevant
  // video_metrics rows for this card grid, then aggregate in JS.
  const { data: metrics, error: metricsErr } = await supabase
    .from('video_metrics')
    .select('video_id, channel_id, trend_score, lifecycle_status, computed_at')
    .in('channel_id', youtubeChannelIds)
    .gte('computed_at', sevenDaysAgoIso)
    .not('trend_score', 'is', null)
    .order('trend_score', { ascending: false, nullsFirst: false })

  if (metricsErr) {
    console.error('fetchTrendingByChannel: video_metrics query failed', metricsErr)
    return new Map()
  }
  if (!metrics || metrics.length === 0) return new Map()

  // Pull cluster membership (size + label + mega flag + archetype label) for
  // every video we surfaced. ONE query joining trend_cluster_members →
  // trend_clusters → narrative_archetypes.
  const videoIds = metrics.map(m => m.video_id as string)
  const { data: clusters, error: clusterErr } = await supabase
    .from('trend_cluster_members')
    .select(`
      video_id,
      trend_clusters!inner(
        id, label, video_count, is_mega_cluster,
        narrative_archetypes(display_label)
      )
    `)
    .in('video_id', videoIds)

  if (clusterErr) {
    console.error('fetchTrendingByChannel: cluster lookup failed', clusterErr)
    // Soft-fail: continue with score-only TrendData (no cluster fields).
  }

  type ArchetypeRow = { display_label: string }
  type TrendClusterRow = {
    id: number
    label: string | null
    video_count: number
    is_mega_cluster: boolean | null
    narrative_archetypes: ArchetypeRow | ArchetypeRow[] | null
  }
  type ClusterRow = {
    video_id: string
    trend_clusters: TrendClusterRow | TrendClusterRow[] | null
  }

  // Map video_id → biggest cluster's payload
  const clusterByVideo = new Map<string, { size: number; label?: string; isMega: boolean; archetype?: string }>()
  for (const row of (clusters ?? []) as ClusterRow[]) {
    const tc = Array.isArray(row.trend_clusters) ? row.trend_clusters[0] : row.trend_clusters
    if (!tc) continue
    const archetype = Array.isArray(tc.narrative_archetypes)
      ? tc.narrative_archetypes[0]
      : tc.narrative_archetypes
    const size = Number(tc.video_count ?? 0)
    const prev = clusterByVideo.get(row.video_id)
    if (!prev || size > prev.size) {
      clusterByVideo.set(row.video_id, {
        size,
        label: tc.label ?? undefined,
        isMega: !!tc.is_mega_cluster,
        archetype: archetype?.display_label,
      })
    }
  }

  // Aggregate per channel: pick highest trend_score, attach the largest
  // cluster signal across all that channel's surfaced videos.
  const byChannel = new Map<string, TrendData>()
  for (const m of metrics) {
    const channelId = String(m.channel_id)
    const score = Number(m.trend_score ?? 0)
    const lifecycle = (m.lifecycle_status as TrendLifecycle | null) ?? null
    const cluster = clusterByVideo.get(String(m.video_id))

    const existing = byChannel.get(channelId)
    if (!existing) {
      byChannel.set(channelId, {
        trendScore: score,
        lifecycleStatus: lifecycle,
        clusterSize: cluster?.size ?? 0,
        clusterLabel: cluster?.label,
        isMegaCluster: cluster?.isMega,
        narrativeArchetypeLabel: cluster?.archetype,
      })
    } else {
      // Score: max
      if (score > existing.trendScore) {
        existing.trendScore = score
        existing.lifecycleStatus = lifecycle
      }
      // Cluster: keep biggest across all videos
      if (cluster && cluster.size > existing.clusterSize) {
        existing.clusterSize = cluster.size
        existing.clusterLabel = cluster.label
        existing.isMegaCluster = cluster.isMega
        existing.narrativeArchetypeLabel = cluster.archetype
      }
    }
  }
  return byChannel
}
