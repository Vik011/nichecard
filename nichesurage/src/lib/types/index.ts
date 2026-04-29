export type {
  UserTier,
  ViralityRating,
  ContentLanguage,
  ContentType,
  BillingInterval,
  DbUser,
  DbScanResult,
} from './database'
import type { ViralityRating, ContentLanguage, ContentType } from './database'

export type ChannelAge = '1month' | '3months' | '6months' | '1year' | 'any'

export interface SearchFilters {
  contentType: ContentType
  subscriberMin: number
  subscriberMax: number
  channelAge: ChannelAge
  onlyRecentlyViral: boolean
}

interface BaseNicheCardData {
  id: string
  contentType: ContentType
  channelCreatedAt: string
  videoCount: number
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
