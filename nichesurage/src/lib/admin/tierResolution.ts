export type TierSource = 'stripe' | 'manual' | null
export type UserTier = 'free' | 'basic' | 'premium'

export interface UserTierInput {
  tier: UserTier
  tier_source: TierSource
  tier_expires_at: string | null
  banned_at: string | null
}

/**
 * App-layer safety net for tier entitlement. Called wherever we'd otherwise
 * read user.tier directly for an entitlement decision. Handles two cases the
 * raw column can't:
 *   1. banned_at set → user is denied all paid features regardless of stored tier
 *   2. manual grant past tier_expires_at → downgrade to free even if the
 *      Phase-1 cron hasn't run yet (cron is optimization, this is correctness)
 */
export function resolveUserTier(user: UserTierInput, now: Date = new Date()): UserTier {
  if (user.banned_at) return 'free'
  if (user.tier_source === 'manual' && user.tier_expires_at) {
    if (new Date(user.tier_expires_at) <= now) return 'free'
  }
  return user.tier
}
