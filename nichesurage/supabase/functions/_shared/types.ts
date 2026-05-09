export type WatchlistTier = 'candidate' | 'observed' | 'permanent'

// Sprint B Phase 1+: lifecycle phase classifier for a video's growth curve.
// Stored in video_metrics.lifecycle_status (enum lifecycle_status_enum).
export type LifecycleStatus = 'emerging' | 'exploding' | 'peak' | 'saturated' | 'dying'

export interface WatchlistChannel {
  id: string
  youtube_channel_id: string
  channel_name: string
  niche_label: string
  content_type: 'shorts' | 'longform'
  // Sprint A.8: scanner is EN-only; existing 'de' rows are soft-deleted
  // (is_active=false) but the column stays for reversibility. New inserts
  // from /discover always set 'en'.
  language: 'en' | 'de'
  is_active: boolean
  first_discovered_at: string
  last_scanned_at: string | null
  seed_keyword: string | null
  // Sprint B Phase 1+: 3-tier candidate universe. Optional here because
  // older rows / fixtures may not yet have it; column has DB default 'permanent'.
  tier?: WatchlistTier | null
  // Sprint B Phase 1+: industry-standard category (12-niche enum).
  // NULL until recategorize backfill runs.
  category?: string | null
}

export interface SeedKeyword {
  id: string
  term: string
  // Sprint A.8: see WatchlistChannel.language note. Active seeds are 'en' only.
  language: 'en' | 'de'
  content_type: 'shorts' | 'longform' | 'both'
  priority: number
  is_active: boolean
  last_used_at: string | null
  // Sprint A.10 (PR #56): category_enum string from 0024 trend engine schema.
  // Set by 0038 backfill + 0039 inserts. NULL only on legacy DE seeds.
  category?: string | null
}

export interface VideoSearchHit {
  videoId: string
  channelId: string
  title: string
  publishedAt: string
}

export interface YouTubeChannelData {
  channelId: string
  channelName: string
  subscriberCount: number
  videoCount: number
  channelCreatedAt: string
  uploadsPlaylistId: string
}

export interface VideoData {
  videoId: string
  title: string
  description: string
  viewCount: number
  likeCount: number
  commentCount: number
  publishedAt: string
  // Sprint A.8: video duration in seconds. Used by premiumSpike to filter
  // a channel's video pool to its actual format (longform >180s, shorts ≤180s).
  // Populated by getRecentVideos via contentDetails.duration (ISO-8601).
  durationSeconds: number
}

// Sprint B Phase 2: time-series snapshot row inserted into video_snapshots
// on every scan. INSERT-only (never updated) — multiple rows per video over
// time IS the data we use for velocity / acceleration / trend score.
export interface VideoSnapshot {
  videoId: string
  channelId: string
  viewCount: number
  likeCount: number
  commentCount: number
  durationSeconds: number
  thumbnailUrl: string
  title: string
  publishedAt: string  // ISO 8601
  scannedAt: string    // ISO 8601, set by caller (so all videos in one scan share a timestamp)
}
