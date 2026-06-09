export type {
  UserTier,
  ViralityRating,
  ContentLanguage,
  ContentType,
  BillingInterval,
  SubscriptionStatus,
  DbUser,
  DbScanResult,
  DbNicheHealthCheck,
} from './database'
import type { ViralityRating, ContentLanguage, ContentType, LifecycleStatus } from './database'
// Sprint B trend types (TrendData, TrendLifecycle, TrendClusterCard,
// TREND_BADGE_*, CLUSTER_FEED_*) removed 2026-05-07 with the trend-
// engine deprecation. The corresponding `trend.ts` file is gone too.

export type ChannelAge = '1month' | '3months' | '6months' | '1year' | 'any'
export type SortBy = 'score' | 'newest'

export interface SpikePoint {
  day: string
  spikeX: number
}

export interface ChannelVideo {
  id: string
  title: string
  thumbnail: string
  viewCount: number
  publishedAt: string
}

export interface ContentAngle {
  title: string
  hook: string
  format: 'shorts' | 'longform'
  why: string
}

export interface SearchFilters {
  contentType: ContentType
  subscriberMin: number
  subscriberMax: number
  channelAge: ChannelAge
  onlyRecentlyViral: boolean
  sortBy: SortBy
}

interface BaseNicheCardData {
  id: string
  youtubeChannelId: string
  contentType: ContentType
  channelCreatedAt: string
  videoCount: number
  subscriberCount: number
  subscriberRange: string
  spikeMultiplier: number
  opportunityScore: number
  viralityRating: ViralityRating
  language: ContentLanguage
  // basic+ tier fields
  channelName?: string
  nicheLabel?: string
  channelUrl?: string
  views48h?: number
  engagementRate?: number
  // landing page only
  trending?: boolean
  // Sonar
  outlierRatio?: number
  isSpike?: boolean
  outlierVideoTitle?: string
  outlierVideoViews?: number
  clusterId?: string
  clusterLabel?: string
  seedKeyword?: string
  // Sprint Y (PR #59): raw category_enum value from channels_watchlist.
  // Use enumValueToBucket() from categoryBuckets.ts to translate to the
  // 7 user-facing bucket labels (Tech & AI, Finance, etc.) for display.
  category?: string
  // Part B (momentum) — set by fetchDiscoverFeed.attachMomentum() from the
  // channel_current_momentum view. Undefined on surfaces that don't attach
  // momentum (landing/dashboard/related); inside the discover momentum feed
  // spikingNow is ALWAYS an explicit boolean (missing view row → false), which
  // is what stops NicheCard's `data.spikingNow ?? isSpikingNow(data)` fallback
  // from firing on the momentum surface.
  spikingNow?: boolean
  momentumTrendScore?: number
  momentumViewsPerHour?: number
  momentumLifecycleStatus?: LifecycleStatus | null
  momentumVideoId?: string | null
  // PR 4: catalog-only card sourced from channels_watchlist (no scan_results
  // row). When true, NicheCard renders the honest catalog variant — no score /
  // virality / spike / Spiking-Now / health / bookmark. The required
  // score-shaped base fields carry inert placeholders the catalog branch never
  // reads. `lastUploadAt` (channels_watchlist.last_upload_at) drives the
  // "Last upload" chip in that variant.
  catalogOnly?: boolean
  lastUploadAt?: string
}

export interface TrendingCluster {
  id: string
  label: string
  memberCount: number
  language: ContentLanguage | null
  contentType: 'shorts' | 'longform' | 'both' | null
}

export interface ShortsNicheCardData extends BaseNicheCardData {
  contentType: 'shorts'
  avgViewDurationPct?: number
  hookScore?: number
}

export interface LongformNicheCardData extends BaseNicheCardData {
  contentType: 'longform'
  searchVolume?: number
  competitionScore?: number
  avgViewsPerVideo?: number
}

export type NicheCardData = ShortsNicheCardData | LongformNicheCardData

export interface DashboardStats {
  totalNichesDetected: number
  averageSpike: number
  topLanguage: ContentLanguage
  lastScanMinutesAgo: number
  nextScanMinutes: number
}

export type FilterOption = 'all' | 'mega' | 'en' | 'de' | 'score80'
