import { createClient } from './client'
import type { SearchFilters, ChannelAge, SpikePoint, TrendingCluster } from '@/lib/types'
import type { NicheCardData, ShortsNicheCardData, LongformNicheCardData } from '@/lib/types'
import type { DbScanResult } from '@/lib/types/database'
import { attachCategories } from '@/lib/discover/fetchDiscoverFeed'
import { getAllowedChannelIds } from '@/lib/discover/channelGate'

type ScanResultWithCluster = DbScanResult & {
  niche_clusters?: { id: string; label: string } | null
}

export function toSubscriberRange(count: number): string {
  if (count < 1000)   return '<1K'
  if (count < 5000)   return '1K–5K'
  if (count < 10000)  return '5K–10K'
  if (count < 50000)  return '10K–50K'
  if (count < 100000) return '50K–100K'
  if (count < 500000) return '100K–500K'
  return '500K+'
}

export function mapRow(row: DbScanResult | ScanResultWithCluster): NicheCardData {
  const cluster = (row as ScanResultWithCluster).niche_clusters
  const base = {
    id: row.id,
    youtubeChannelId: row.youtube_channel_id,
    channelCreatedAt: row.channel_created_at,
    videoCount: row.video_count,
    subscriberCount: row.subscriber_count,
    subscriberRange: toSubscriberRange(row.subscriber_count),
    spikeMultiplier: row.spike_multiplier,
    opportunityScore: row.opportunity_score,
    viralityRating: row.virality_rating,
    language: row.language,
    channelName: row.channel_name,
    nicheLabel: cluster?.label || row.niche_label,
    channelUrl: row.channel_url,
    engagementRate: row.engagement_rate,
    views48h: row.views_48h,
    // Sonar
    outlierRatio: row.outlier_ratio ?? undefined,
    isSpike: row.is_spike,
    outlierVideoTitle: row.outlier_video_title ?? undefined,
    outlierVideoViews: row.outlier_video_views ?? undefined,
    clusterId: row.cluster_id ?? undefined,
    clusterLabel: cluster?.label ?? undefined,
    seedKeyword: row.seed_keyword ?? undefined,
  }

  if (row.content_type === 'shorts') {
    return {
      ...base,
      contentType: 'shorts',
      hookScore: row.hook_score ?? undefined,
      avgViewDurationPct: row.avg_view_duration_pct ?? undefined,
    } satisfies ShortsNicheCardData
  }

  return {
    ...base,
    contentType: 'longform',
    searchVolume: row.search_volume ?? undefined,
    competitionScore: row.competition_score ?? undefined,
    avgViewsPerVideo: row.views_avg,
  } satisfies LongformNicheCardData
}

function channelAgeCutoff(age: Exclude<ChannelAge, 'any'>): string {
  const days: Record<Exclude<ChannelAge, 'any'>, number> = {
    '1month': 30,
    '3months': 90,
    '6months': 180,
    '1year': 365,
  }
  const d = new Date()
  d.setDate(d.getDate() - days[age])
  return d.toISOString().split('T')[0]
}

const SONAR_UI_THRESHOLD = Number(process.env.NEXT_PUBLIC_OUTLIER_UI_THRESHOLD ?? '5')

// Sprint B Phase 7A: cap of channel candidates pulled from video_metrics in
// hot mode. We then filter to the active surface (subs / age / cluster) and
// re-rank by trend_score in JS. 30 keeps payload small and matches the
// existing 20-row default the legacy mode uses.
const HOT_MODE_CHANNEL_LIMIT = 30
const HOT_MODE_WINDOW_DAYS = 7

export type DiscoverMode = 'hot' | 'quality' | 'all'

export interface FetchNichesOptions {
  clusterId?: string
  /**
   * Sprint B Phase 7A. 'hot' re-ranks by max(trend_score) over recent
   * video_metrics rows (filters dying lifecycle by default). 'quality' and
   * 'all' both keep the legacy outlier_ratio + is_spike behavior — 'all' is
   * the default to preserve every existing call site.
   */
  mode?: DiscoverMode
  /**
   * In hot mode, dying-lifecycle channels are dropped unless this is true.
   * Per plan Step 7.12.
   */
  includeDying?: boolean
}

export async function fetchNiches(
  filters: SearchFilters,
  options: FetchNichesOptions = {},
): Promise<{ data: NicheCardData[]; error: string | null }> {
  const mode: DiscoverMode = options.mode ?? 'all'
  if (mode === 'hot') {
    return fetchHotNiches(filters, options)
  }
  return fetchQualityNiches(filters, options)
}

async function fetchQualityNiches(
  filters: SearchFilters,
  options: FetchNichesOptions,
): Promise<{ data: NicheCardData[]; error: string | null }> {
  const supabase = createClient()

  // Faceless catalog gate: Sonar search is a faceless-only surface, so it must
  // not return face/uncertain/evicted channels. Same gate as the All tab.
  const allowedIds = await getAllowedChannelIds(supabase)
  if (allowedIds.length === 0) return { data: [], error: null }

  // Sonar default sort: outlier_ratio desc. "newest" preserved for users who
  // want the freshest discoveries regardless of magnitude.
  const orderColumn = filters.sortBy === 'newest' ? 'scanned_at' : 'outlier_ratio'

  // When a cluster filter is active (user clicked a Trending Topics chip),
  // the user has explicitly chosen "show me what is in THIS group". Stacking
  // the global is_spike + outlier floor on top is over-filtering — empirically
  // (verified 2026-05-06) it can drop a 16-member cluster to 0 visible
  // because no current member is spiking right now. Cluster context replaces
  // those floors as the relevance signal.
  const inClusterMode = Boolean(options.clusterId)

  let query = supabase
    .from('scan_results_latest')
    .select('*, niche_clusters(id, label)')
    .eq('content_type', filters.contentType)
    .in('youtube_channel_id', allowedIds)
    .gte('subscriber_count', filters.subscriberMin)
    .lte('subscriber_count', filters.subscriberMax)
    .order(orderColumn, { ascending: false, nullsFirst: false })
    .limit(20)

  if (!inClusterMode) {
    query = query
      .eq('is_spike', true)
      .gte('outlier_ratio', SONAR_UI_THRESHOLD)
  }

  if (options.clusterId) {
    query = query.eq('cluster_id', options.clusterId)
  }

  if (filters.channelAge !== 'any') {
    query = query.gte('channel_created_at', channelAgeCutoff(filters.channelAge))
  }

  if (filters.onlyRecentlyViral) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('scanned_at', sevenDaysAgo)
  }

  const { data, error } = await query

  if (error) return { data: [], error: 'Search failed. Please try again.' }
  return { data: (data ?? []).map(row => mapRow(row as ScanResultWithCluster)), error: null }
}

// Hot mode deliberately ignores `filters.sortBy` — the mode IS the sort
// (max trend_score across recent video_metrics). The SearchFilters Sort
// dropdown still renders in the parent UI when mode==='hot' but silently
// no-ops; Phase 7B will hide it to avoid the inconsistency.
// TODO(phase-7b): hide SearchFilters Sort control when mode==='hot'.
async function fetchHotNiches(
  filters: SearchFilters,
  options: FetchNichesOptions,
): Promise<{ data: NicheCardData[]; error: string | null }> {
  const supabase = createClient()

  // Faceless catalog gate: hot trending is faceless-only. We intersect the
  // trend-ranked channel set with the allowed set in JS (rather than a second
  // .in() on the same column) so a non-faceless channel can never surface here.
  const allowedIds = await getAllowedChannelIds(supabase)
  if (allowedIds.length === 0) return { data: [], error: null }
  const allowedSet = new Set(allowedIds)

  const sevenDaysAgoIso = new Date(Date.now() - HOT_MODE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Step 1: top channels by max(trend_score) within the hot window. Supabase
  // JS doesn't support GROUP BY, so we pull rows ordered by trend_score desc
  // and dedupe to first-seen channel_id (which is its max because of the order).
  const { data: metrics, error: metricsErr } = await supabase
    .from('video_metrics')
    .select('channel_id, trend_score, lifecycle_status')
    .gte('computed_at', sevenDaysAgoIso)
    .not('trend_score', 'is', null)
    .order('trend_score', { ascending: false, nullsFirst: false })
    .limit(500)

  if (metricsErr) return { data: [], error: 'Search failed. Please try again.' }
  if (!metrics || metrics.length === 0) return { data: [], error: null }

  // Filter dying rows out FIRST so a channel whose top-scored video is
  // dying (but who also has a healthier video in the window) can still
  // surface via the healthier video's score. Without this, the original
  // scoreByChannel.has() check would skip the dying row, leaving the
  // channel out entirely. (CQ review found the bug 2026-05-04.)
  const includeDying = options.includeDying ?? false
  const scoreByChannel = new Map<string, number>()
  for (const m of metrics) {
    if (!includeDying && m.lifecycle_status === 'dying') continue
    const ch = String(m.channel_id)
    // Apply the faceless catalog gate INSIDE the loop, before the cap, so
    // HOT_MODE_CHANNEL_LIMIT counts faceless channels — not the top-N global
    // (mostly non-faceless) trend-ranked channels, which would under-fill hot.
    if (!allowedSet.has(ch)) continue
    if (scoreByChannel.has(ch)) continue
    scoreByChannel.set(ch, Number(m.trend_score ?? 0))
    if (scoreByChannel.size >= HOT_MODE_CHANNEL_LIMIT) break
  }
  if (scoreByChannel.size === 0) return { data: [], error: null }

  // Every key is already faceless-gated (filtered in the loop above).
  const channelIds = Array.from(scoreByChannel.keys())

  // Step 2: surface scan_results_latest rows for those channels. We drop
  // is_spike + outlier_ratio floors (hot mode trusts trend_score) but keep
  // user-controlled subscriber/age filters intact.
  let query = supabase
    .from('scan_results_latest')
    .select('*, niche_clusters(id, label)')
    .eq('content_type', filters.contentType)
    .gte('subscriber_count', filters.subscriberMin)
    .lte('subscriber_count', filters.subscriberMax)
    .in('youtube_channel_id', channelIds)

  if (options.clusterId) {
    query = query.eq('cluster_id', options.clusterId)
  }
  if (filters.channelAge !== 'any') {
    query = query.gte('channel_created_at', channelAgeCutoff(filters.channelAge))
  }
  if (filters.onlyRecentlyViral) {
    query = query.gte('scanned_at', sevenDaysAgoIso)
  }

  const { data, error } = await query
  if (error) return { data: [], error: 'Search failed. Please try again.' }

  // Step 3: re-rank in JS by trend_score desc (preserve hot ordering).
  const mapped = (data ?? []).map(row => mapRow(row as ScanResultWithCluster))
  mapped.sort((a, b) => {
    const sa = scoreByChannel.get(a.youtubeChannelId) ?? 0
    const sb = scoreByChannel.get(b.youtubeChannelId) ?? 0
    return sb - sa
  })
  return { data: mapped, error: null }
}

/**
 * Fetch trending niche clusters with LIVE member counts.
 *
 * Why not read niche_clusters.member_count directly: that field is a
 * frozen historical count that does not get updated when channels are
 * evicted, deactivated, or roll out of scan_results_latest. Empirically
 * (verified 2026-05-06): a cluster shown as "16 members" in the carousel
 * had ZERO matching rows in scan_results_latest. Carousel was lying.
 *
 * Approach: aggregate scan_results_latest by cluster_id (current source
 * of truth for "who is in a cluster RIGHT NOW"), filter by the page's
 * content_type so a longform page does not surface shorts-only clusters
 * (and vice versa), join niche_clusters for labels. Clusters with zero
 * current members are silently dropped.
 *
 * The carousel chip count now matches what the user sees when they click
 * the chip (modulo additional user filters like subscriber range).
 */
export async function fetchTrendingClusters(
  contentType: 'shorts' | 'longform',
  limit = 8,
): Promise<TrendingCluster[]> {
  const supabase = createClient()

  // Faceless catalog gate: cluster member counts must reflect only faceless
  // channels, otherwise the carousel inflates counts with face/evicted members.
  const allowedIds = await getAllowedChannelIds(supabase)
  if (allowedIds.length === 0) return []

  // Step 1: pull all scan_results_latest rows with cluster_id for the given
  // content_type. Bounded by current universe size (~hundreds at MVP scale),
  // so pulling and aggregating client-side is cheaper than an RPC.
  const { data: members, error: membersErr } = await supabase
    .from('scan_results_latest')
    .select('cluster_id')
    .eq('content_type', contentType)
    .not('cluster_id', 'is', null)
    .in('youtube_channel_id', allowedIds)
    .limit(50_000)

  if (membersErr || !members || members.length === 0) return []

  // Aggregate counts per cluster.
  const counts = new Map<string, number>()
  for (const row of members as Array<{ cluster_id: string }>) {
    if (!row.cluster_id) continue
    counts.set(row.cluster_id, (counts.get(row.cluster_id) ?? 0) + 1)
  }
  if (counts.size === 0) return []

  // Pick top N by count.
  const topIds = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id)

  // Step 2: fetch labels + metadata for top clusters.
  const { data: clusters, error: clustersErr } = await supabase
    .from('niche_clusters')
    .select('id, label, language, content_type')
    .in('id', topIds)

  if (clustersErr || !clusters) return []

  // Preserve top-N order from counts (Supabase doesn't honor IN-list order).
  const byId = new Map(
    (clusters as Array<{
      id: string
      label: string
      language: 'en' | 'de' | null
      content_type: 'shorts' | 'longform' | 'both' | null
    }>).map((c) => [c.id, c]),
  )

  const out: TrendingCluster[] = []
  for (const id of topIds) {
    const c = byId.get(id)
    if (!c) continue // lost FK or RLS-blocked cluster row
    out.push({
      id: c.id,
      label: c.label,
      memberCount: counts.get(id) ?? 0,
      language: c.language,
      contentType: c.content_type,
    })
  }
  return out
}

export async function fetchRelatedNiches(source: NicheCardData, limit = 3): Promise<NicheCardData[]> {
  const supabase = createClient()
  // Faceless catalog gate: related niches must come from the same
  // faceless+active+not-evicted set as the All tab, never raw scan_results_latest
  // (which still holds face/uncertain/evicted channels). No freshness gate —
  // Similar is a related-catalog section, not a current-momentum one.
  const allowedIds = await getAllowedChannelIds(supabase)
  if (allowedIds.length === 0) return []
  const lower = Math.max(0, Math.floor(source.subscriberCount * 0.3))
  const upper = Math.max(lower + 1, Math.ceil(source.subscriberCount * 3))
  // Prefer same-cluster siblings when available; fall back to language+type+size band.
  if (source.clusterId) {
    const { data } = await supabase
      .from('scan_results_latest')
      .select('*, niche_clusters(id, label)')
      .eq('cluster_id', source.clusterId)
      .neq('id', source.id)
      .in('youtube_channel_id', allowedIds)
      .order('outlier_ratio', { ascending: false, nullsFirst: false })
      .limit(limit)
    if (data && data.length > 0) {
      const mapped = data.map(row => mapRow(row as ScanResultWithCluster))
      await attachCategories(supabase, mapped)
      return mapped
    }
  }
  const { data, error } = await supabase
    .from('scan_results_latest')
    .select('*, niche_clusters(id, label)')
    .eq('language', source.language)
    .eq('content_type', source.contentType)
    .neq('id', source.id)
    .in('youtube_channel_id', allowedIds)
    .gte('subscriber_count', lower)
    .lte('subscriber_count', upper)
    .order('opportunity_score', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  const mapped = data.map(row => mapRow(row as ScanResultWithCluster))
  await attachCategories(supabase, mapped)
  return mapped
}

export async function fetchNicheById(id: string): Promise<NicheCardData | null> {
  const supabase = createClient()
  // Faceless catalog gate: a direct niche-detail lookup must not resolve a
  // face/uncertain/evicted channel (a guessed or shared URL would otherwise
  // leak one that never appears in the gated feeds).
  const allowedIds = await getAllowedChannelIds(supabase)
  if (allowedIds.length === 0) return null
  const { data, error } = await supabase
    .from('scan_results_latest')
    .select('*, niche_clusters(id, label)')
    .eq('id', id)
    .in('youtube_channel_id', allowedIds)
    .maybeSingle()
  if (error || !data) return null
  const mapped = mapRow(data as ScanResultWithCluster)
  await attachCategories(supabase, [mapped])
  return mapped
}

export async function fetchSpikeHistory(youtubeChannelId: string): Promise<SpikePoint[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('channel_spike_history_30d')
    .select('day, spike_x')
    .eq('youtube_channel_id', youtubeChannelId)
    .order('day', { ascending: true })
  if (error || !data) return []
  return data.map(row => ({ day: row.day as string, spikeX: Number(row.spike_x) }))
}
