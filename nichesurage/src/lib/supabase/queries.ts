import { createClient } from './client'
import type { SearchFilters, ChannelAge, SpikePoint, TrendingCluster } from '@/lib/types'
import type { NicheCardData, ShortsNicheCardData, LongformNicheCardData } from '@/lib/types'
import type { DbScanResult } from '@/lib/types/database'

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

export interface FetchNichesOptions {
  clusterId?: string
}

export async function fetchNiches(
  filters: SearchFilters,
  options: FetchNichesOptions = {},
): Promise<{ data: NicheCardData[]; error: string | null }> {
  const supabase = createClient()

  // Sonar default sort: outlier_ratio desc. "newest" preserved for users who
  // want the freshest discoveries regardless of magnitude.
  const orderColumn = filters.sortBy === 'newest' ? 'scanned_at' : 'outlier_ratio'
  let query = supabase
    .from('scan_results_latest')
    .select('*, niche_clusters(id, label)')
    .eq('content_type', filters.contentType)
    .eq('is_spike', true)
    .gte('outlier_ratio', SONAR_UI_THRESHOLD)
    .gte('subscriber_count', filters.subscriberMin)
    .lte('subscriber_count', filters.subscriberMax)
    .order(orderColumn, { ascending: false, nullsFirst: false })
    .limit(20)

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

export async function fetchTrendingClusters(limit = 8): Promise<TrendingCluster[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('niche_clusters')
    .select('id, label, member_count, language, content_type')
    .order('member_count', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data.map((c: { id: string; label: string; member_count: number; language: 'en' | 'de' | null; content_type: 'shorts' | 'longform' | 'both' | null }) => ({
    id: c.id,
    label: c.label,
    memberCount: c.member_count,
    language: c.language,
    contentType: c.content_type,
  }))
}

export async function fetchRelatedNiches(source: NicheCardData, limit = 3): Promise<NicheCardData[]> {
  const supabase = createClient()
  const lower = Math.max(0, Math.floor(source.subscriberCount * 0.3))
  const upper = Math.max(lower + 1, Math.ceil(source.subscriberCount * 3))
  // Prefer same-cluster siblings when available; fall back to language+type+size band.
  if (source.clusterId) {
    const { data } = await supabase
      .from('scan_results_latest')
      .select('*, niche_clusters(id, label)')
      .eq('cluster_id', source.clusterId)
      .neq('id', source.id)
      .order('outlier_ratio', { ascending: false, nullsFirst: false })
      .limit(limit)
    if (data && data.length > 0) {
      return data.map(row => mapRow(row as ScanResultWithCluster))
    }
  }
  const { data, error } = await supabase
    .from('scan_results_latest')
    .select('*, niche_clusters(id, label)')
    .eq('language', source.language)
    .eq('content_type', source.contentType)
    .neq('id', source.id)
    .gte('subscriber_count', lower)
    .lte('subscriber_count', upper)
    .order('opportunity_score', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data.map(row => mapRow(row as ScanResultWithCluster))
}

export async function fetchNicheById(id: string): Promise<NicheCardData | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('scan_results_latest')
    .select('*, niche_clusters(id, label)')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return mapRow(data as ScanResultWithCluster)
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
