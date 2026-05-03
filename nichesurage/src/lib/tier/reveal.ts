import type { UserTier } from '@/lib/types/database'

// Reveal logic for the Sprint A.7 three-tier funnel.
//
// Strategic intent:
// - PREMIUM sees everything, no rotation.
// - BASIC sees the top 10 niches by score (positions 0–9 of the sorted
//   feed). They rotate naturally as new scans land in scan_results_latest;
//   we don't manage a separate "BASIC window" — the underlying feed is
//   already the rotation.
// - FREE sees exactly ONE niche unlocked at a time, picked deterministically
//   from positions 9 to 19 of the sorted feed for the current 6h window.
//   The picked niche persists across reloads in the same window so the user
//   has a stable "today's reveal" experience; it advances at the next 6h
//   boundary.
//
// Why deterministic + window-based instead of a DB-tracked rotation:
// - No new DB writes on every page view.
// - Same user + same window → same niche → caching-friendly + shareable.
// - Different users in the same window get different niches (uniform via
//   hashing user_id + window_index), so two friends comparing screenshots
//   see different "reveals", which is itself a marketing surface ("I got
//   X today, what did you get?").
//
// The "always-locked top 9" is the FOMO core: FREE users see 9 blurred
// cards with visible scores RANKED HIGHER than their unlocked one. That's
// the upgrade trigger — not "you don't see anything", but "you see that
// better stuff exists, paywalled".

export const FREE_WINDOW_MS = 6 * 60 * 60 * 1000
export const BASIC_VISIBLE_COUNT = 10
export const FREE_REVEAL_RANGE_START = 9 // first index eligible for FREE reveal
export const FREE_REVEAL_RANGE_END = 19 // last index eligible (inclusive)

/**
 * Stable 32-bit hash. Not cryptographic — we just need a uniform,
 * dependency-free distribution over user_id + window index. Mirrors the
 * pattern used by deterministicChannelNum elsewhere in this codebase
 * (Java String.hashCode-style with Math.imul).
 */
export function hashStringToInt(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** Current 6h window index (UTC), monotonically increasing. */
export function getFreeWindowIndex(now: Date): number {
  return Math.floor(now.getTime() / FREE_WINDOW_MS)
}

/**
 * Pick the index of the FREE-revealed niche for this user in the current
 * 6h window. Picks from [9, 19] inclusive, clamped to the actual pool size.
 * Returns null when the pool has fewer than FREE_REVEAL_RANGE_START + 1
 * items — i.e. there isn't a "position 10+" to reveal, the entire pool is
 * Basic territory.
 */
export function getFreeRevealedIndex(
  userId: string,
  now: Date,
  poolSize: number,
): number | null {
  if (poolSize <= FREE_REVEAL_RANGE_START) return null

  const window = getFreeWindowIndex(now)
  const seed = hashStringToInt(`${userId}:${window}`)

  // Effective range: [FREE_REVEAL_RANGE_START, min(FREE_REVEAL_RANGE_END, poolSize - 1)]
  const lastIndex = Math.min(FREE_REVEAL_RANGE_END, poolSize - 1)
  const span = lastIndex - FREE_REVEAL_RANGE_START + 1 // inclusive count
  return FREE_REVEAL_RANGE_START + (seed % span)
}

/**
 * Returns the set of niche IDs currently unlocked for this user/tier in
 * the current window. Premium gets everything, Basic gets the top 10 by
 * input order, Free gets exactly one (or zero, if pool is too small).
 *
 * Caller is responsible for sorting `sortedNicheIds` by opportunity score
 * descending — this function does NOT re-sort, it just slices/picks.
 */
export function getRevealedIds(
  tier: UserTier,
  sortedNicheIds: readonly string[],
  userId: string,
  now: Date,
): Set<string> {
  if (tier === 'premium') {
    return new Set(sortedNicheIds)
  }
  if (tier === 'basic') {
    return new Set(sortedNicheIds.slice(0, BASIC_VISIBLE_COUNT))
  }
  // free
  const idx = getFreeRevealedIndex(userId, now, sortedNicheIds.length)
  if (idx === null) return new Set()
  return new Set([sortedNicheIds[idx]])
}

/**
 * Next reveal boundary for FREE users — the start of the next 6h window.
 * Returns null for tiers that don't rotate (Basic / Premium see their
 * full slot continuously and don't need a countdown).
 */
export function getNextRevealAt(tier: UserTier, now: Date): Date | null {
  if (tier !== 'free') return null
  const window = getFreeWindowIndex(now)
  return new Date((window + 1) * FREE_WINDOW_MS)
}

/**
 * Convenience: milliseconds until the next FREE reveal. Returns null for
 * non-FREE tiers. Caller drives the UI countdown with this.
 */
export function getMsUntilNextReveal(tier: UserTier, now: Date): number | null {
  const at = getNextRevealAt(tier, now)
  if (!at) return null
  return Math.max(0, at.getTime() - now.getTime())
}
