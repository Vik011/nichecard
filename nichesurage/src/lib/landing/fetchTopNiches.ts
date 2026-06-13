import { createStaticClient } from '@/lib/supabase/staticClient'
import { toSubscriberRange } from '@/lib/supabase/queries'
import type { NicheCardData } from '@/lib/types'

// Row shape returned by the public.public_landing_niches() RPC (migration
// 0067). SAFE COLUMNS ONLY — this projection deliberately contains no
// channel_name / channel_url / youtube_channel_id / niche_label /
// outlier_video_* / channel_created_at. The logged-out landing page reads
// this RPC (anon) instead of scan_results_latest, which 0068 revokes for anon.
interface PublicLandingNicheRow {
  id: string
  channel_num: number
  opportunity_score: number
  virality_rating: 'excellent' | 'good' | 'average'
  spike_multiplier: number
  engagement_rate: number
  views_48h: number
  views_avg: number
  subscriber_count: number
  video_count: number
  content_type: 'shorts' | 'longform'
  language: 'en' | 'de'
  is_spike: boolean
  outlier_ratio: number | null
  cluster_id: string | null
  scanned_at: string
}

// Coarse, non-identifying teaser label derived from content_type only. The
// real per-channel niche_label is paid-gated and never leaves the DB on the
// anon landing path (PR-C.1 / C1).
function coarseLabel(contentType: 'shorts' | 'longform'): string {
  return contentType === 'shorts' ? 'Faceless Shorts' : 'Faceless Long-form'
}

// Build a teaser NicheCardData from a safe RPC row. `youtubeChannelId` and
// `channelCreatedAt` are required by the shared type but are never rendered on
// the landing card, so they carry empty placeholders rather than real
// identity. The masked channel name uses the server-computed channel_num
// (seeded from the opaque scan_results.id, not youtube_channel_id).
function mapLandingRow(row: PublicLandingNicheRow): NicheCardData {
  const base = {
    id: row.id,
    youtubeChannelId: '',
    channelCreatedAt: '',
    channelName: `Hidden Channel #${row.channel_num}`,
    nicheLabel: coarseLabel(row.content_type),
    channelUrl: undefined,
    videoCount: row.video_count,
    subscriberCount: row.subscriber_count,
    subscriberRange: toSubscriberRange(row.subscriber_count),
    spikeMultiplier: row.spike_multiplier,
    opportunityScore: row.opportunity_score,
    viralityRating: row.virality_rating,
    language: row.language,
    views48h: row.views_48h,
    engagementRate: row.engagement_rate,
    outlierRatio: row.outlier_ratio ?? undefined,
    isSpike: row.is_spike,
    trending: row.spike_multiplier >= 5,
  }

  if (row.content_type === 'shorts') {
    return { ...base, contentType: 'shorts' }
  }
  return { ...base, contentType: 'longform', avgViewsPerVideo: row.views_avg }
}

export async function fetchTopNiches(): Promise<NicheCardData[]> {
  const supabase = createStaticClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .rpc('public_landing_niches')
    .gte('scanned_at', since)
    .order('opportunity_score', { ascending: false })
    .limit(6)

  if (error || !data) {
    console.error('[fetchTopNiches]', error?.message ?? 'no data returned')
    return []
  }

  return (data as PublicLandingNicheRow[]).map(mapLandingRow)
}
