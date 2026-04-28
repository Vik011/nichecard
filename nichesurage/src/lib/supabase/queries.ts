import { createClient } from './client'
import type { SearchFilters, ChannelAge } from '@/lib/types'
import type { NicheCardData, ShortsNicheCardData, LongformNicheCardData } from '@/lib/types'
import type { DbScanResult } from '@/lib/types/database'

export function toSubscriberRange(count: number): string {
  if (count < 1000)   return '<1K'
  if (count < 5000)   return '1K–5K'
  if (count < 10000)  return '5K–10K'
  if (count < 50000)  return '10K–50K'
  if (count < 100000) return '50K–100K'
  if (count < 500000) return '100K–500K'
  return '500K+'
}

export function mapRow(row: DbScanResult): NicheCardData {
  const base = {
    id: row.id,
    channelCreatedAt: row.channel_created_at,
    videoCount: row.video_count,
    subscriberRange: toSubscriberRange(row.subscriber_count),
    spikeMultiplier: row.spike_multiplier,
    opportunityScore: row.opportunity_score,
    viralityRating: row.virality_rating,
    language: row.language,
    channelName: row.channel_name,
    nicheLabel: row.niche_label,
    channelUrl: row.channel_url,
    engagementRate: row.engagement_rate,
    views48h: row.views_48h,
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

export async function fetchNiches(
  filters: SearchFilters,
): Promise<{ data: NicheCardData[]; error: string | null }> {
  const supabase = createClient()

  let query = supabase
    .from('scan_results')
    .select('*')
    .eq('content_type', filters.contentType)
    .gte('subscriber_count', filters.subscriberMin)
    .lte('subscriber_count', filters.subscriberMax)
    .order('opportunity_score', { ascending: false })
    .limit(20)

  if (filters.channelAge !== 'any') {
    query = query.gte('channel_created_at', channelAgeCutoff(filters.channelAge))
  }

  if (filters.onlyRecentlyViral) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('spike_multiplier', 3).gte('scanned_at', sevenDaysAgo)
  }

  const { data, error } = await query

  if (error) return { data: [], error: 'Search failed. Please try again.' }
  return { data: (data ?? []).map(mapRow), error: null }
}
