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
