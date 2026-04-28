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
