import type { UserTier } from '@/lib/types/database'

import { getFreeRevealedIndex, FREE_REVEAL_RANGE_START } from './reveal'

// Discover page visible-results derivation.
//
// Fix B for the launch-debug memo Issue #3: the free-tier `?freeReveal=...`
// rotation picks a position from [4, 14], but the default top-N slice
// only shows up to VISIBLE_STEP cards. When the reveal rolls beyond
// VISIBLE_STEP, the unlocked card is hidden behind "Show more" — the
// header reads "1 unlocked" but the user can't see the unlocked one.
//
// This helper rebuilds the visible array for free tier as:
//   [top 4 by score, the revealed niche]
// so position 5 is ALWAYS the rotating reveal, top 4 stay paywalled
// (FOMO), and the user always sees exactly one unlocked card.
//
// Basic/Premium tiers keep the simple slice — they don't rotate, their
// visibility is "first N by score" as before.

/** Anything with an .id field. The discover page passes NicheCardData here. */
export interface IdBearing {
  readonly id: string
}

export interface ComputeVisibleResultsArgs<T extends IdBearing> {
  tier: UserTier
  userId: string
  results: readonly T[]
  /** Effective for non-free tiers only. */
  visibleCount: number
  now: Date
}

/**
 * Returns the slice of `results` to render on /discover.
 *
 * For free tier:
 *   * pool ≤ 4 → return what we have, all paywalled (no reveal possible)
 *   * pool > 4 → return [top 4, results[revealIndex]]; reveal index is the
 *     same one `getRevealedIds` would pick, so the highlight stays in sync
 *     with the unlocked card.
 *
 * For basic/premium: `results.slice(0, visibleCount)` — legacy behavior.
 */
export function computeVisibleResults<T extends IdBearing>(
  args: ComputeVisibleResultsArgs<T>,
): readonly T[] {
  const { tier, userId, results, visibleCount, now } = args
  if (tier !== 'free') {
    return results.slice(0, visibleCount)
  }
  if (results.length <= FREE_REVEAL_RANGE_START) {
    return results.slice(0, FREE_REVEAL_RANGE_START)
  }
  const revealIdx = getFreeRevealedIndex(userId, now, results.length)
  if (revealIdx === null) {
    return results.slice(0, FREE_REVEAL_RANGE_START)
  }
  const top = results.slice(0, FREE_REVEAL_RANGE_START)
  const revealed = results[revealIdx]
  if (!revealed) return top
  return [...top, revealed]
}
