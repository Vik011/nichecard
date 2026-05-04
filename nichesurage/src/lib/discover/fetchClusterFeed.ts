import { createClient } from '@/lib/supabase/client'
import {
  CLUSTER_FEED_DEFAULT_LIMIT,
  CLUSTER_FEED_FRESHNESS_DAYS,
  CLUSTER_FEED_SAMPLE_THUMBS,
  type TrendClusterCard,
} from '@/lib/types/trend'

/**
 * Sprint B Phase 7B — cluster trending feed.
 *
 * Fetches clusters ordered by avg_trend_score DESC scoped to last 7 days,
 * optionally filtered to a single category. Mega clusters are flagged
 * (isMegaCluster), but separation into a "Cross-niche waves" group is the
 * UI's responsibility — this fetcher returns one homogeneous list.
 *
 * Strategy: 3 batched queries (trend_clusters, trend_cluster_members,
 * video_snapshots) joined client-side. Defensive — returns [] on any
 * error and never throws so the UI degrades silently.
 */
export async function fetchClusterFeed(opts: {
  category?: string
  limit?: number
}): Promise<TrendClusterCard[]> {
  const limit = opts.limit ?? CLUSTER_FEED_DEFAULT_LIMIT
  const supabase = createClient()

  const freshnessIso = new Date(
    Date.now() - CLUSTER_FEED_FRESHNESS_DAYS * 24 * 3600 * 1000,
  ).toISOString()

  // ── Query 1: trend_clusters + narrative archetype label ────────────
  let clustersQuery = supabase
    .from('trend_clusters')
    .select(`
      id, label, category, video_count, channel_count,
      avg_trend_score, is_mega_cluster, mega_cluster_categories,
      last_updated_at,
      narrative_archetypes(display_label)
    `)
    .gte('last_updated_at', freshnessIso)
    .order('avg_trend_score', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (opts.category) {
    clustersQuery = clustersQuery.eq('category', opts.category)
  }

  const { data: clusters, error: clustersErr } = await clustersQuery

  if (clustersErr) {
    console.error('fetchClusterFeed: trend_clusters query failed', clustersErr)
    return []
  }
  if (!clusters || clusters.length === 0) return []

  type ArchetypeRow = { display_label: string }
  type ClusterRow = {
    id: number
    label: string | null
    category: string | null
    video_count: number | null
    channel_count: number | null
    avg_trend_score: number | null
    is_mega_cluster: boolean | null
    mega_cluster_categories: string[] | null
    last_updated_at: string
    narrative_archetypes: ArchetypeRow | ArchetypeRow[] | null
  }

  const clusterIds = (clusters as ClusterRow[]).map(c => c.id)

  // ── Query 2: trend_cluster_members → keep first SAMPLE_THUMBS per cluster.
  // We pull for all cluster ids in one batch and group JS-side.
  const { data: members, error: membersErr } = await supabase
    .from('trend_cluster_members')
    .select('cluster_id, video_id')
    .in('cluster_id', clusterIds)

  if (membersErr) {
    console.error('fetchClusterFeed: trend_cluster_members query failed', membersErr)
    // Soft-fail: still return cards, just without sample thumbnails.
  }

  type MemberRow = { cluster_id: number; video_id: string }

  const videoIdsByCluster = new Map<number, string[]>()
  for (const row of (members ?? []) as MemberRow[]) {
    const list = videoIdsByCluster.get(row.cluster_id) ?? []
    if (list.length < CLUSTER_FEED_SAMPLE_THUMBS) {
      list.push(row.video_id)
      videoIdsByCluster.set(row.cluster_id, list)
    }
  }

  const allVideoIds = Array.from(
    new Set(Array.from(videoIdsByCluster.values()).flat()),
  )

  // ── Query 3: video_snapshots → most-recent thumbnail+title per video.
  const snapshotByVideo = new Map<string, { thumb: string | null; title: string | null }>()
  if (allVideoIds.length > 0) {
    const { data: snapshots, error: snapsErr } = await supabase
      .from('video_snapshots')
      .select('video_id, thumbnail_url, title, scanned_at')
      .in('video_id', allVideoIds)
      .order('scanned_at', { ascending: false })

    if (snapsErr) {
      console.error('fetchClusterFeed: video_snapshots query failed', snapsErr)
      // Soft-fail again: cards without thumbnails are still useful.
    } else {
      type SnapRow = {
        video_id: string
        thumbnail_url: string | null
        title: string | null
        scanned_at: string
      }
      // Order is DESC scanned_at — first occurrence is the most recent.
      for (const row of (snapshots ?? []) as SnapRow[]) {
        if (!snapshotByVideo.has(row.video_id)) {
          snapshotByVideo.set(row.video_id, { thumb: row.thumbnail_url, title: row.title })
        }
      }
    }
  }

  // ── Assemble cards ─────────────────────────────────────────────────
  const cards: TrendClusterCard[] = (clusters as ClusterRow[]).map(c => {
    const archetype = Array.isArray(c.narrative_archetypes)
      ? c.narrative_archetypes[0]
      : c.narrative_archetypes

    const memberVideoIds = videoIdsByCluster.get(c.id) ?? []
    const sampleThumbnails: string[] = []
    const sampleTitles: string[] = []
    for (const vid of memberVideoIds) {
      const snap = snapshotByVideo.get(vid)
      if (snap?.thumb) {
        sampleThumbnails.push(snap.thumb)
        sampleTitles.push(snap.title ?? '')
      }
    }

    return {
      id: String(c.id),
      label: c.label ?? '(unlabeled cluster)',
      category: c.category,
      narrativeArchetypeLabel: archetype?.display_label,
      videoCount: Number(c.video_count ?? 0),
      channelCount: Number(c.channel_count ?? 0),
      avgTrendScore: Number(c.avg_trend_score ?? 0),
      isMegaCluster: !!c.is_mega_cluster,
      megaCategories: Array.isArray(c.mega_cluster_categories) ? c.mega_cluster_categories : [],
      sampleThumbnails,
      sampleTitles,
      lastUpdatedAt: c.last_updated_at,
    }
  })

  return cards
}
