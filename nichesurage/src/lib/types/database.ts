export type UserTier = 'free' | 'basic' | 'premium'
export type ViralityRating = 'excellent' | 'good' | 'average'
export type ContentLanguage = 'en' | 'de'

export interface DbUser {
  id: string
  email: string
  tier: UserTier
  stripe_customer_id: string | null
  daily_searches_used: number
  created_at: string
}

export interface DbScanResult {
  id: string
  youtube_channel_id: string
  channel_name: string
  niche_label: string
  channel_url: string
  channel_created_at: string
  video_count: number
  subscriber_count: number
  views_48h: number
  views_avg: number
  spike_multiplier: number
  engagement_rate: number
  opportunity_score: number
  virality_rating: ViralityRating
  language: ContentLanguage
  scanned_at: string
}
