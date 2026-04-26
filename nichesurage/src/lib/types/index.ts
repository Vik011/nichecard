export type { UserTier, ViralityRating, ContentLanguage, DbUser, DbScanResult } from './database'
import type { ViralityRating, ContentLanguage } from './database'

export interface NicheCardData {
  id: string
  channelCreatedAt: string
  videoCount: number
  subscriberRange: string
  spikeMultiplier: number
  opportunityScore: number
  viralityRating: ViralityRating
  language: ContentLanguage
  // Only populated for basic+ tier
  channelName?: string
  nicheLabel?: string
  channelUrl?: string
  views48h?: number
  engagementRate?: number
}

export interface DashboardStats {
  totalNichesDetected: number
  averageSpike: number
  topLanguage: ContentLanguage
  lastScanMinutesAgo: number
  nextScanMinutes: number
}

export type FilterOption = 'all' | 'mega' | 'en' | 'de' | 'score80'
