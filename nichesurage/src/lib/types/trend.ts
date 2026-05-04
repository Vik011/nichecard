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
