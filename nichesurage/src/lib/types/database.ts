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

// ─── Sprint B: Trend Detection Engine ────────────────────────────────
// Mirrors enums + tables in 0024_trend_engine_schema.sql. Keep in sync.

export type CategoryEnum =
  | 'ai_tools' | 'finance' | 'crypto' | 'tech_reviews'
  | 'gaming_streamers' | 'fitness_health' | 'self_improvement'
  | 'true_crime' | 'luxury_lifestyle' | 'celebrity_drama'
  | 'geopolitics_news' | 'education_howto'

export type WatchlistTier = 'candidate' | 'observed' | 'permanent'
export type LifecycleStatus = 'emerging' | 'exploding' | 'peak' | 'saturated' | 'dying'
export type ArchetypeStatus = 'canonical' | 'candidate' | 'rejected'

export interface VideoSnapshot {
  id: number
  video_id: string
  channel_id: string
  scanned_at: string
  view_count: number
  like_count: number | null
  comment_count: number | null
  duration_seconds: number | null
  thumbnail_url: string | null
  title: string | null
  published_at: string | null
}

export interface VideoMetrics {
  video_id: string
  channel_id: string | null
  category: CategoryEnum | null
  latest_views: number | null
  views_per_hour: number | null
  comments_per_hour: number | null
  likes_per_hour: number | null
  velocity_delta: number | null
  view_acceleration: number | null
  breakout_ratio: number | null
  novelty_score: number | null
  trend_score: number | null
  lifecycle_status: LifecycleStatus | null
  topic_tags: string[] | null
  computed_at: string
}

export interface TrendCluster {
  id: number
  label: string | null
  category: CategoryEnum | null
  narrative_archetype_id: string | null
  video_count: number
  channel_count: number
  first_seen_at: string | null
  last_updated_at: string
  avg_trend_score: number | null
  is_mega_cluster: boolean
  mega_cluster_categories: CategoryEnum[] | null
}

export interface NarrativeArchetype {
  id: string
  display_label: string
  status: ArchetypeStatus
  detection_count: number
  first_detected_at: string
  promoted_at: string | null
  description: string | null
}

export interface VideoRecommendation {
  source_video_id: string
  related_video_id: string
  position: number
  discovered_at: string
}
