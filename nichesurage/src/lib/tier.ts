import type { UserTier } from '@/lib/types'

export function canViewChannelDetails(tier: UserTier): boolean {
  return tier === 'basic' || tier === 'premium'
}

export function canUseAIFeatures(tier: UserTier): boolean {
  return tier === 'premium'
}

export function getSubscriberRange(tier: UserTier, count: number): string {
  if (canViewChannelDetails(tier)) {
    return count.toLocaleString('en-US')
  }
  if (count < 1000) return '0–1k range'
  if (count < 5000) return '1k–5k range'
  if (count < 10000) return '5k–10k range'
  return '10k+ range'
}

export function getDailySearchLimit(tier: UserTier): number {
  if (tier === 'premium') return Infinity
  if (tier === 'basic') return 20
  return 3
}

export function getMaxNichesVisible(tier: UserTier): number {
  if (tier === 'premium') return 50
  if (tier === 'basic') return 20
  return 5
}

export function getSaveLimit(tier: UserTier): number {
  if (tier === 'premium') return Infinity
  if (tier === 'basic') return 10
  return 0
}
