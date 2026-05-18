// supabase/functions/_shared/discoveryPlan.test.ts
//
// Deno test runner (Jest ignores supabase/functions per jest.config.ts).
// Run locally: `deno test supabase/functions/_shared/discoveryPlan.test.ts`
// (pure functions, no net hits.)
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  buildQueryPlan,
  computeCoverageDeficit,
  withinMonthlyBudget,
} from './discoveryPlan.ts'

// ---- computeCoverageDeficit -------------------------------------------------

Deno.test('computeCoverageDeficit: absent category counts as 0 (full deficit)', () => {
  const result = computeCoverageDeficit({}, 400)
  // All 12 categories absent => all have deficit 400.
  assertEquals(result.length, 12)
  for (const d of result) assertEquals(d.deficit, 400)
})

Deno.test('computeCoverageDeficit: categories at or above target are excluded', () => {
  const result = computeCoverageDeficit(
    { ai_tools: 400, finance: 500, crypto: 399 },
    400,
  )
  // ai_tools at target, finance above target => both excluded.
  // crypto below by 1 => included. The other 9 absent => included.
  assertEquals(result.find(d => d.category === 'ai_tools'), undefined)
  assertEquals(result.find(d => d.category === 'finance'), undefined)
  assertEquals(result.find(d => d.category === 'crypto')?.deficit, 1)
  assertEquals(result.length, 10)
})

Deno.test('computeCoverageDeficit: sorted by deficit descending', () => {
  const result = computeCoverageDeficit(
    { ai_tools: 100, finance: 300, crypto: 50 },
    400,
  )
  // The 9 absent categories have deficit 400 (highest), then crypto 350,
  // ai_tools 300, finance 100.
  const deficits = result.map(d => d.deficit)
  const sorted = [...deficits].sort((a, b) => b - a)
  assertEquals(deficits, sorted)
  assertEquals(result[result.length - 1].category, 'finance')
  assertEquals(result[result.length - 1].deficit, 100)
})

Deno.test('computeCoverageDeficit: alphabetical tie-break within equal deficit', () => {
  // All 12 absent => all deficit 400 => order must be alphabetical.
  const result = computeCoverageDeficit({}, 400)
  const cats = result.map(d => d.category)
  const sorted = [...cats].sort()
  assertEquals(cats, sorted)
})

Deno.test('computeCoverageDeficit: alphabetical tie-break only within equal deficit', () => {
  const result = computeCoverageDeficit(
    { ai_tools: 350, true_crime: 350 },
    400,
  )
  // ai_tools and true_crime both have deficit 50; the 10 absent ones have
  // deficit 400 and sort first. Within the deficit-50 group, ai_tools < true_crime.
  const tail = result.slice(-2).map(d => d.category)
  assertEquals(tail, ['ai_tools', 'true_crime'])
})

Deno.test('computeCoverageDeficit: all 12 at target returns empty', () => {
  const counts: Record<string, number> = {}
  for (const c of [
    'ai_tools', 'finance', 'crypto', 'tech_reviews', 'gaming_streamers',
    'fitness_health', 'self_improvement', 'true_crime', 'luxury_lifestyle',
    'celebrity_drama', 'geopolitics_news', 'education_howto',
  ]) counts[c] = 400
  assertEquals(computeCoverageDeficit(counts, 400), [])
})

Deno.test('computeCoverageDeficit: unknown categories in counts are ignored', () => {
  // A bogus key must not appear in output and must not crash.
  const result = computeCoverageDeficit({ underwater_basket_weaving: 5 }, 400)
  assertEquals(result.length, 12)
  assertEquals(result.find(d => d.category === 'underwater_basket_weaving'), undefined)
})

// ---- buildQueryPlan ---------------------------------------------------------

function seeds(...terms: string[]) {
  return terms.map((term, i) => ({ id: `${term}-${i}`, term }))
}

Deno.test('buildQueryPlan: empty deficits returns empty output', () => {
  const plan = buildQueryPlan([], {}, 8)
  assertEquals(plan.keywords, [])
  assertEquals(plan.categoryTargets, {})
  assertEquals(plan.seedIds, [])
})

Deno.test('buildQueryPlan: no seeds for any deficit category returns empty output', () => {
  const plan = buildQueryPlan(
    [{ category: 'crypto', deficit: 400 }],
    {},
    8,
  )
  assertEquals(plan.keywords, [])
  assertEquals(plan.categoryTargets, {})
  assertEquals(plan.seedIds, [])
})

Deno.test('buildQueryPlan: slots sum to exactly queriesPerRun when seeds abundant', () => {
  const plan = buildQueryPlan(
    [
      { category: 'crypto', deficit: 300 },
      { category: 'finance', deficit: 100 },
    ],
    {
      crypto: seeds('c1', 'c2', 'c3', 'c4', 'c5', 'c6'),
      finance: seeds('f1', 'f2', 'f3', 'f4'),
    },
    8,
  )
  assertEquals(plan.keywords.length, 8)
  assertEquals(plan.seedIds.length, 8)
  const total = Object.values(plan.categoryTargets).reduce((a, b) => a + b, 0)
  assertEquals(total, 8)
})

Deno.test('buildQueryPlan: largest-remainder proportional allocation', () => {
  // deficits 300 / 100 => 3:1 ratio of 8 slots => crypto 6, finance 2.
  const plan = buildQueryPlan(
    [
      { category: 'crypto', deficit: 300 },
      { category: 'finance', deficit: 100 },
    ],
    {
      crypto: seeds('c1', 'c2', 'c3', 'c4', 'c5', 'c6'),
      finance: seeds('f1', 'f2', 'f3', 'f4'),
    },
    8,
  )
  assertEquals(plan.categoryTargets.crypto, 6)
  assertEquals(plan.categoryTargets.finance, 2)
})

Deno.test('buildQueryPlan: largest-remainder rounds fractional shares deterministically', () => {
  // Three equal deficits, 8 slots => exact share 2.666 each. Floor gives
  // 2 each (6 total), 2 remainders go to the largest fractional parts.
  // All remainders equal => alphabetical tie-break: ai_tools, crypto first.
  const plan = buildQueryPlan(
    [
      { category: 'ai_tools', deficit: 100 },
      { category: 'crypto', deficit: 100 },
      { category: 'finance', deficit: 100 },
    ],
    {
      ai_tools: seeds('a1', 'a2', 'a3', 'a4'),
      crypto: seeds('c1', 'c2', 'c3', 'c4'),
      finance: seeds('f1', 'f2', 'f3', 'f4'),
    },
    8,
  )
  const total = Object.values(plan.categoryTargets).reduce((a, b) => a + b, 0)
  assertEquals(total, 8)
  assertEquals(plan.categoryTargets.ai_tools, 3)
  assertEquals(plan.categoryTargets.crypto, 3)
  assertEquals(plan.categoryTargets.finance, 2)
})

Deno.test('buildQueryPlan: zero-seed category skipped, slots redistributed', () => {
  // crypto would get the lion's share by deficit but has zero seeds, so all
  // 8 slots redistribute to finance.
  const plan = buildQueryPlan(
    [
      { category: 'crypto', deficit: 900 },
      { category: 'finance', deficit: 100 },
    ],
    {
      crypto: [],
      finance: seeds('f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9'),
    },
    8,
  )
  assertEquals(plan.categoryTargets.crypto, undefined)
  assertEquals(plan.categoryTargets.finance, 8)
  assertEquals(plan.keywords.length, 8)
  for (const kw of plan.keywords) assertEquals(kw.startsWith('f'), true)
})

Deno.test('buildQueryPlan: category with fewer seeds than slots contributes only its seeds', () => {
  // crypto allocated most slots but only has 2 seeds => contributes 2 only.
  const plan = buildQueryPlan(
    [
      { category: 'crypto', deficit: 700 },
      { category: 'finance', deficit: 300 },
    ],
    {
      crypto: seeds('c1', 'c2'),
      finance: seeds('f1', 'f2', 'f3', 'f4', 'f5', 'f6'),
    },
    8,
  )
  assertEquals(plan.categoryTargets.crypto, 2)
  // 8 slots total: crypto contributes its 2, finance covers the rest it can.
  assertEquals(plan.keywords.length, 8)
  assertEquals(plan.categoryTargets.finance, 6)
})

Deno.test('buildQueryPlan: keywords capped at total available seeds', () => {
  // Only 3 seeds total but queriesPerRun is 8 => output capped at 3.
  const plan = buildQueryPlan(
    [
      { category: 'crypto', deficit: 500 },
      { category: 'finance', deficit: 500 },
    ],
    {
      crypto: seeds('c1', 'c2'),
      finance: seeds('f1'),
    },
    8,
  )
  assertEquals(plan.keywords.length, 3)
  assertEquals(plan.seedIds.length, 3)
  const total = Object.values(plan.categoryTargets).reduce((a, b) => a + b, 0)
  assertEquals(total, 3)
})

Deno.test('buildQueryPlan: no seed picked twice', () => {
  const plan = buildQueryPlan(
    [
      { category: 'crypto', deficit: 300 },
      { category: 'finance', deficit: 300 },
    ],
    {
      crypto: seeds('c1', 'c2', 'c3', 'c4'),
      finance: seeds('f1', 'f2', 'f3', 'f4'),
    },
    8,
  )
  assertEquals(new Set(plan.seedIds).size, plan.seedIds.length)
  assertEquals(new Set(plan.keywords).size, plan.keywords.length)
})

Deno.test('buildQueryPlan: seeds picked in given order (least-recently-used first)', () => {
  // crypto allocated 2 slots; must pick the first 2 seeds in order.
  const plan = buildQueryPlan(
    [
      { category: 'crypto', deficit: 100 },
      { category: 'finance', deficit: 300 },
    ],
    {
      crypto: seeds('oldest', 'newer', 'newest'),
      finance: seeds('f1', 'f2', 'f3', 'f4', 'f5', 'f6'),
    },
    8,
  )
  assertEquals(plan.categoryTargets.crypto, 2)
  // The two crypto keywords chosen must be the first two in order.
  const cryptoKeywords = plan.keywords.filter(k => ['oldest', 'newer', 'newest'].includes(k))
  assertEquals(cryptoKeywords, ['oldest', 'newer'])
})

Deno.test('buildQueryPlan: seedIds correspond to chosen keywords', () => {
  const plan = buildQueryPlan(
    [{ category: 'crypto', deficit: 100 }],
    { crypto: seeds('a', 'b', 'c') },
    2,
  )
  assertEquals(plan.keywords.length, 2)
  assertEquals(plan.seedIds, ['a-0', 'b-1'])
})

// ---- withinMonthlyBudget ----------------------------------------------------

Deno.test('withinMonthlyBudget: comfortably under budget returns true', () => {
  assertEquals(withinMonthlyBudget(10, 0.5, 25), true)
})

Deno.test('withinMonthlyBudget: exactly at the boundary returns true', () => {
  // 24.5 + 0.5 == 25 => allowed.
  assertEquals(withinMonthlyBudget(24.5, 0.5, 25), true)
})

Deno.test('withinMonthlyBudget: over the boundary returns false', () => {
  // 24.6 + 0.5 == 25.1 > 25 => denied.
  assertEquals(withinMonthlyBudget(24.6, 0.5, 25), false)
})

Deno.test('withinMonthlyBudget: zero spend returns true', () => {
  assertEquals(withinMonthlyBudget(0, 0.5, 25), true)
})
