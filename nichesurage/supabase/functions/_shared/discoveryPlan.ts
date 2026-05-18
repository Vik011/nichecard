// supabase/functions/_shared/discoveryPlan.ts
//
// Apify Discovery Engine Phase 3: pure planning logic for discover-plan.
//
// Coverage-driven discovery: figure out which of the 12 content categories
// are under-populated in channels_watchlist, then build a weighted set of
// YouTube search queries that favours the thin categories. Every function
// here is pure and deterministic so the whole module is unit-testable
// without any IO. The discover-plan edge function does the IO and delegates
// every decision to this module.

import { CATEGORIES } from './categories.ts'

export interface CategoryDeficit {
  category: string
  deficit: number
}

export interface SeedRef {
  id: string
  term: string
}

export interface QueryPlan {
  keywords: string[]
  categoryTargets: Record<string, number>
  seedIds: string[]
}

/**
 * Compute, per category, how far below the per-category target the
 * channels_watchlist population is.
 *
 * A category absent from `countsByCategory` counts as 0 channels (full
 * deficit). Categories already at or above target are dropped. The result is
 * sorted by deficit descending, with an alphabetical-by-category tie-break so
 * the ordering is fully deterministic.
 */
export function computeCoverageDeficit(
  countsByCategory: Record<string, number>,
  targetPerCategory: number,
): CategoryDeficit[] {
  const deficits: CategoryDeficit[] = []
  for (const category of CATEGORIES) {
    const count = countsByCategory[category] ?? 0
    const deficit = Math.max(0, targetPerCategory - count)
    if (deficit > 0) deficits.push({ category, deficit })
  }
  deficits.sort((a, b) =>
    b.deficit - a.deficit || a.category.localeCompare(b.category)
  )
  return deficits
}

/**
 * Allocate exactly `queriesPerRun` query slots across the deficit categories,
 * proportional to each category's deficit, using the largest-remainder
 * (Hamilton) method so the slot counts are deterministic and sum exactly.
 *
 * A category with no seeds is skipped gracefully and its slots redistribute
 * to the others. Within a category, seeds are picked in the order given (the
 * caller pre-sorts least-recently-used first) and never picked twice. If a
 * category gets more slots than it has seeds it contributes only its seeds.
 *
 * The total emitted keyword count is min(queriesPerRun, total available
 * seeds). If no deficit category has any seeds, all outputs are empty.
 */
export function buildQueryPlan(
  deficits: CategoryDeficit[],
  seedsByCategory: Record<string, SeedRef[]>,
  queriesPerRun: number,
): QueryPlan {
  // Only categories that actually have seeds can receive slots.
  const eligible = deficits
    .map(d => ({
      category: d.category,
      deficit: d.deficit,
      seeds: seedsByCategory[d.category] ?? [],
    }))
    .filter(e => e.seeds.length > 0)

  const totalAvailableSeeds = eligible.reduce((sum, e) => sum + e.seeds.length, 0)
  if (totalAvailableSeeds === 0 || queriesPerRun <= 0) {
    return { keywords: [], categoryTargets: {}, seedIds: [] }
  }

  // The number of slots we can actually fill is capped by the seed supply.
  let slotsToFill = Math.min(queriesPerRun, totalAvailableSeeds)

  // Largest-remainder allocation proportional to deficit. We iterate so that
  // when a category is capped by its seed count, the freed slots are
  // re-allocated across the still-uncapped categories.
  const allocation: Record<string, number> = {}
  let remaining = eligible.map(e => ({
    category: e.category,
    deficit: e.deficit,
    capacity: e.seeds.length,
  }))

  while (slotsToFill > 0 && remaining.length > 0) {
    const totalDeficit = remaining.reduce((sum, r) => sum + r.deficit, 0)

    let assignedThisRound: Record<string, number>
    if (totalDeficit === 0) {
      // All remaining categories have zero deficit (degenerate input):
      // distribute slots evenly, largest-remainder on equal shares.
      assignedThisRound = largestRemainder(
        remaining.map(r => ({ key: r.category, weight: 1 })),
        slotsToFill,
      )
    } else {
      assignedThisRound = largestRemainder(
        remaining.map(r => ({ key: r.category, weight: r.deficit })),
        slotsToFill,
      )
    }

    // Apply the round, capping each category at its remaining capacity.
    let overflow = 0
    for (const r of remaining) {
      const want = assignedThisRound[r.category] ?? 0
      const give = Math.min(want, r.capacity)
      allocation[r.category] = (allocation[r.category] ?? 0) + give
      r.capacity -= give
      overflow += want - give
    }

    slotsToFill = overflow
    // Drop categories that are now full; only the rest can absorb overflow.
    remaining = remaining.filter(r => r.capacity > 0)
  }

  // Materialise the chosen seeds in deterministic order: follow the deficit
  // ordering of `eligible`, take the first N seeds per category.
  const keywords: string[] = []
  const seedIds: string[] = []
  const categoryTargets: Record<string, number> = {}
  for (const e of eligible) {
    const take = allocation[e.category] ?? 0
    if (take <= 0) continue
    categoryTargets[e.category] = take
    for (let i = 0; i < take; i++) {
      keywords.push(e.seeds[i].term)
      seedIds.push(e.seeds[i].id)
    }
  }

  return { keywords, categoryTargets, seedIds }
}

/**
 * Largest-remainder (Hamilton) apportionment: distribute `total` whole units
 * across weighted keys so the per-key counts sum to exactly `total`. Ties on
 * the fractional remainder break alphabetically by key for determinism.
 */
function largestRemainder(
  items: { key: string; weight: number }[],
  total: number,
): Record<string, number> {
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0)
  if (totalWeight === 0) return {}

  const shares = items.map(i => {
    const exact = (i.weight / totalWeight) * total
    const floor = Math.floor(exact)
    return { key: i.key, floor, remainder: exact - floor }
  })

  const result: Record<string, number> = {}
  let assigned = 0
  for (const s of shares) {
    result[s.key] = s.floor
    assigned += s.floor
  }

  // Hand out the leftover units to the largest fractional remainders.
  let leftover = total - assigned
  const ranked = [...shares].sort((a, b) =>
    b.remainder - a.remainder || a.key.localeCompare(b.key)
  )
  for (const s of ranked) {
    if (leftover <= 0) break
    result[s.key] += 1
    leftover--
  }

  return result
}

/**
 * Returns true if a run is allowed: its worst-case cost (`perRunCeilingUsd`)
 * added to the current month's spend still fits within the monthly budget.
 */
export function withinMonthlyBudget(
  monthSpendUsd: number,
  perRunCeilingUsd: number,
  monthlyBudgetUsd: number,
): boolean {
  return monthSpendUsd + perRunCeilingUsd <= monthlyBudgetUsd
}
