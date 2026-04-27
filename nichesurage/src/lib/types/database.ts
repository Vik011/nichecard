export type UserTier = 'free' | 'basic' | 'premium'
export type ViralityRating = 'excellent' | 'good' | 'average'
export type ContentLanguage = 'en' | 'de'
export type ContentType = 'shorts' | 'longform'
export type BillingInterval = 'monthly' | 'monthly_annual' | 'annual'

export interface DbUser {
  id: string
  email: string
  tier: UserTier
  billing_interval: BillingInterval | null
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
  content_type: ContentType
  // Shorts-specific (null for longform rows)
  hook_score: number | null
  avg_view_duration_pct: number | null
  // Longform-specific (null for shorts rows)
  search_volume: number | null
  competition_score: number | null
  scanned_at: string
}
