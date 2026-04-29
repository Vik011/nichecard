// supabase/functions/_shared/metrics.ts
import type { VideoData } from './types.ts'

export function computeViews48h(videos: VideoData[]): number {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000)
  return videos
    .filter(v => new Date(v.publishedAt) >= cutoff)
    .reduce((sum, v) => sum + v.viewCount, 0)
}

export function computeViewsAvg(videos: VideoData[]): number {
  if (videos.length === 0) return 0
  return videos.reduce((sum, v) => sum + v.viewCount, 0) / videos.length
}

export function computeSpikeMultiplier(views48h: number, viewsAvg: number): number {
  if (viewsAvg === 0) return 0
  return Math.min(views48h / viewsAvg, 50)
}

export function computeEngagementRate(video: VideoData): number {
  if (video.viewCount === 0) return 0
  return (video.likeCount + video.commentCount) / video.viewCount
}

export function computeViralityRating(spikeMultiplier: number): 'excellent' | 'good' | 'average' {
  if (spikeMultiplier >= 10) return 'excellent'
  if (spikeMultiplier >= 3) return 'good'
  return 'average'
}

export function computeOpportunityScore(
  spikeMultiplier: number,
  subscriberCount: number,
  channelCreatedAt: string,
  contentType: 'shorts' | 'longform'
): number {
  const maxSubs = contentType === 'shorts' ? 100_000 : 500_000
  const channelAgeDays = (Date.now() - new Date(channelCreatedAt).getTime()) / (1000 * 60 * 60 * 24)

  const spikeScore = Math.min(spikeMultiplier / 20, 1) * 40
  const sizeScore = Math.max(0, 1 - subscriberCount / maxSubs) * 30
  const ageScore = Math.max(0, 1 - channelAgeDays / 365) * 30

  return Math.round(spikeScore + sizeScore + ageScore)
}

export function computeHookScore(video: VideoData): number | null {
  if (video.viewCount === 0) return null
  return (video.likeCount / video.viewCount) * 100
}

export function computeCompetitionScore(subscriberCount: number, maxSubs: number): number {
  return Math.round((subscriberCount / maxSubs) * 100)
}
