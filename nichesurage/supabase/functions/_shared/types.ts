export interface WatchlistChannel {
  id: string
  youtube_channel_id: string
  channel_name: string
  niche_label: string
  content_type: 'shorts' | 'longform'
  language: 'en' | 'de'
  is_active: boolean
  first_discovered_at: string
  last_scanned_at: string | null
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
  viewCount: number
  likeCount: number
  commentCount: number
  publishedAt: string
}
