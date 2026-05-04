// Sprint B Phase 7A: per-channel trend signal payload attached to NicheCard.
// Channel-aggregated max(trend_score) over recent video_metrics rows + the
// "hottest" video's lifecycle status + the largest cluster the channel
// participates in. Phase 5 sub-pieces (trend_clusters, narrative_archetypes,
// mega-cluster flag) bubble up here for badge rendering.
export type TrendLifecycle =
  | 'emerging'
  | 'exploding'
  | 'peak'
  | 'saturated'
  | 'dying'

export interface TrendData {
  trendScore: number          // 0..100; max per channel in the surfaced window
  lifecycleStatus: TrendLifecycle | null  // null when no metrics yet
  clusterSize: number         // largest cluster_size for any video on this channel; 0 if not in any cluster
  clusterLabel?: string       // trend_clusters.label (Claude-generated) for the largest cluster
  isMegaCluster?: boolean     // trend_clusters.is_mega_cluster on the largest cluster
  narrativeArchetypeLabel?: string  // narrative_archetypes.display_label
}

// Threshold to render a "🔥 TRENDING" badge. Tuned conservative — Phase 9
// production validation may revise.
export const TREND_BADGE_SCORE_THRESHOLD = 60
export const TREND_BADGE_CLUSTER_THRESHOLD = 5

// Sprint B Phase 7B: cluster-feed card payload. Shape returned by
// fetchClusterFeed and consumed by TrendingClusterCard. We centralise it
// here next to TrendData so all trend-surface types live in one place.
export interface TrendClusterCard {
  id: string                               // cluster.id stringified for URL routing
  label: string                            // claude-generated label, fallback '(unlabeled cluster)'
  category: string | null                  // category_enum value
  narrativeArchetypeLabel?: string         // narrative_archetypes.display_label
  videoCount: number
  channelCount: number
  avgTrendScore: number
  isMegaCluster: boolean
  megaCategories: string[]                 // category_enum[] from mega_cluster_categories
  sampleThumbnails: string[]               // up to 4, preview-quality thumbnails
  sampleTitles: string[]                   // up to 4, paired with thumbnails by index
  lastUpdatedAt: string                    // ISO timestamp
  lifecycleHint?: TrendLifecycle | null    // most-common lifecycle of cluster members (soft cue)
}

// Phase 7B feed knobs — exported so tests + page can re-use without magic numbers.
export const CLUSTER_FEED_DEFAULT_LIMIT = 24
export const CLUSTER_FEED_FRESHNESS_DAYS = 7
export const CLUSTER_FEED_SAMPLE_THUMBS = 4
