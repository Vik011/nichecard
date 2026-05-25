import type { UserTier } from '@/lib/types/database'

// /discover visible-results derivation.
//
// FREE: top 4 by score + the globally-pinned daily niche (1 unlock).
// The pin id comes from `daily_demo_niche` via /api/demo/today; passed
// in by the caller so this stays a pure function.
//
// BASIC / PREMIUM: simple slice(0, visibleCount).

const FREE_TOP_LOCKED = 4

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
  /** Today's globally-pinned scan_result_id. Null when no pin yet. */
  todayPinId: string | null
}

export function computeVisibleResults<T extends IdBearing>(
  args: ComputeVisibleResultsArgs<T>,
): readonly T[] {
  const { tier, results, visibleCount, todayPinId } = args
  if (tier !== 'free') {
    return results.slice(0, visibleCount)
  }
  if (results.length <= FREE_TOP_LOCKED) {
    return results.slice(0, results.length)
  }
  const top = results.slice(0, FREE_TOP_LOCKED)
  if (!todayPinId) return top
  if (top.some((r) => r.id === todayPinId)) return top
  const pin = results.find((r) => r.id === todayPinId)
  if (!pin) return top
  return Array.from(top).concat([pin])
}
