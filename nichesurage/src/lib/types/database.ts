export type UserTier = 'free' | 'basic' | 'premium'
export type ViralityRating = 'excellent' | 'good' | 'average'
export type ContentLanguage = 'en' | 'de'
export type ContentType = 'shorts' | 'longform'
export type BillingInterval = 'monthly' | 'yearly'
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'

export interface DbUser {
  id: string
  email: string
  tier: UserTier
  billing_interval: BillingInterval | null
  subscription_status: SubscriptionStatus | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_current_period_end: string | null
  daily_searches_used: number
  created_at: string
}

export interface DbNicheHealthCheck {
  id: string
  scan_result_id: string
  health_score: number
  components: {
    spike: number
    opportunity: number
    engagement: number
    virality: number
    saturation: number
  }
  verdict_text: string
  computed_at: string
  expires_at: string
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
  // Sonar fields (added in 0012)
  outlier_ratio: number | null
  is_spike: boolean
  outlier_video_id: string | null
  outlier_video_title: string | null
  outlier_video_views: number | null
  window_hours: number
  seed_keyword: string | null
  cluster_id: string | null
}

export interface DbNicheCluster {
  id: string
  label: string
  member_count: number
  language: ContentLanguage | null
  content_type: ContentType | 'both' | null
  last_labeled_at: string
  updated_at: string
}
