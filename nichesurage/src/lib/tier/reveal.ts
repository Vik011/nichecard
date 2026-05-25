import type { UserTier } from '@/lib/types/database'
import { nextUtcMidnight } from '@/lib/demo/dailyModalCookie'

// Reveal logic post free-tier paywall fix.
//
// - PREMIUM: every fetched niche is unlocked.
// - BASIC: top BASIC_VISIBLE_COUNT by input order.
// - FREE: exactly ONE niche unlocked — the globally-pinned daily demo
//   from `daily_demo_niche`. Caller fetches the pin id and passes it in.
//   Identical for every free user and across every /discover surface tab,
//   so a user can never see more than 1 unlocked niche per UTC day.
//
// Rotation: next UTC midnight. The 6h hash-window scheme that produced
// up to 4 reveals/day was removed — see the 2026-05-22 paywall plan.

export const BASIC_VISIBLE_COUNT = 5

/**
 * Returns the set of niche IDs currently unlocked for this user/tier.
 *
 * `todayPinId` is the `scan_results.id` returned by `getDailyDemoNiche`
 * (or `/api/demo/today`). Pass `null` if the lookup failed or the pool
 * is cold — FREE will see everything blurred, which is correct.
 *
 * `userId` and `now` are kept on the signature for symmetry but only
 * Premium / Basic ignore them outright; FREE no longer reads either
 * (the pin is global-deterministic, not per-user).
 */
export function getRevealedIds(
  tier: UserTier,
  sortedNicheIds: readonly string[],
  _userId: string,
  _now: Date,
  todayPinId: string | null,
): Set<string> {
  if (tier === 'premium') {
    return new Set(sortedNicheIds)
  }
  if (tier === 'basic') {
    return new Set(sortedNicheIds.slice(0, BASIC_VISIBLE_COUNT))
  }
  // free
  if (!todayPinId) return new Set()
  if (!sortedNicheIds.includes(todayPinId)) return new Set()
  return new Set([todayPinId])
}

/**
 * Next reveal boundary. FREE rotates at next UTC midnight (globally
 * shared with `daily_demo_niche.date` rotation). Basic/Premium return
 * null — no countdown.
 */
export function getNextRevealAt(tier: UserTier, now: Date): Date | null {
  if (tier !== 'free') return null
  return nextUtcMidnight(now)
}

/** Convenience for the UI countdown. */
export function getMsUntilNextReveal(tier: UserTier, now: Date): number | null {
  const at = getNextRevealAt(tier, now)
  if (!at) return null
  return Math.max(0, at.getTime() - now.getTime())
}
