// supabase/functions/_shared/baseline.test.ts
//
// Sprint B Phase 5A: tests for channel + niche baseline subtraction and
// the pure novelty-score helper.
//
// Deno test runner (Jest ignores supabase/functions per jest.config.ts).
// Run locally: `deno test supabase/functions/_shared/baseline.test.ts`
import {
  assertAlmostEquals,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  computeChannelBaseline,
  computeNicheBaseline,
  computeNoveltyScore,
} from './baseline.ts'

// ─── Supabase mock helpers ──────────────────────────────────────────
//
// Pattern: chainable thenable returning {data, error}. Matches the
// minimum surface area used by baseline.ts:
//
//   supabase.from(table).select(cols).eq(col, val).gte(col, val) → Promise<{data, error}>
//
// For the niche query that needs an .in() filter on channel_id, we
// also support .in(col, arr).
//
// We capture every call into `recorded` so tests can assert SQL shape
// (filter columns, table name, etc.).

interface RecordedCall {
  table: string
  select?: string
  filters: Array<{ op: string; col: string; val: unknown }>
}

interface MockResponse {
  // Map from "tableName::filterDigest" to data rows. Simpler: we route
  // by table name only and the test sets per-table responses.
  [table: string]: { data: unknown[] | null; error: unknown }
}

interface MockClient {
  recorded: RecordedCall[]
  from: (table: string) => unknown
}

function makeSupabaseMock(responses: MockResponse): MockClient {
  const recorded: RecordedCall[] = []

  function builder(table: string) {
    const call: RecordedCall = { table, filters: [] }
    recorded.push(call)

    const chain = {
      select(cols: string) {
        call.select = cols
        return chain
      },
      eq(col: string, val: unknown) {
        call.filters.push({ op: 'eq', col, val })
        return chain
      },
      gte(col: string, val: unknown) {
        call.filters.push({ op: 'gte', col, val })
        return chain
      },
      in(col: string, val: unknown) {
        call.filters.push({ op: 'in', col, val })
        return chain
      },
      // Thenable: when awaited, returns the canned response for this table.
      then(resolve: (v: unknown) => void) {
        const r = responses[table] ?? { data: [], error: null }
        resolve(r)
      },
    }
    return chain
  }

  return {
    recorded,
    from: builder,
  }
}

// ─── computeNoveltyScore (pure) ──────────────────────────────────────

Deno.test('novelty: niche=10, current=30 → 2.0 (3x − 1x = 2x above)', () => {
  // formula: (current - niche) / max(niche, 1) = (30-10)/10 = 2.0
  assertAlmostEquals(computeNoveltyScore(30, 5, 10), 2.0, 0.001)
})

Deno.test('novelty: niche=10, current=10 → 0 (matches niche norm)', () => {
  assertEquals(computeNoveltyScore(10, 5, 10), 0)
})

Deno.test('novelty: niche=0 (empty data) → uses 1 in denom, current=5 → 5', () => {
  // (5 - 0) / max(0, 1) = 5/1 = 5
  assertEquals(computeNoveltyScore(5, 0, 0), 5)
})

Deno.test('novelty: negative current views (defensive) → 0 floor on result', () => {
  // (-50 - 10) / 10 = -6 → clamp to 0 (negative novelty = "below niche", not novel)
  assertEquals(computeNoveltyScore(-50, 5, 10), 0)
})

Deno.test('novelty: current below niche → 0 (cannot be "novel" below norm)', () => {
  // (5 - 10) / 10 = -0.5 → clamp to 0
  assertEquals(computeNoveltyScore(5, 5, 10), 0)
})

Deno.test('novelty: ignores channelBaseline arg (filter is caller-side)', () => {
  // Doc invariant: function returns niche-relative score regardless of
  // channel baseline. The 1.5× channel filter is the caller's job.
  const a = computeNoveltyScore(30, 1, 10)
  const b = computeNoveltyScore(30, 1_000_000, 10)
  assertEquals(a, b)
})

// ─── computeChannelBaseline ──────────────────────────────────────────

Deno.test('channelBaseline: median of [1, 2, 3, 100] = 2.5 (NOT the mean 26.5)', async () => {
  const supabase = makeSupabaseMock({
    video_metrics: {
      data: [
        { views_per_hour: 1 },
        { views_per_hour: 2 },
        { views_per_hour: 3 },
        { views_per_hour: 100 },
      ],
      error: null,
    },
  })
  const r = await computeChannelBaseline(supabase as unknown as never, 'UC123', 30)
  assertAlmostEquals(r, 2.5, 0.001)
})

Deno.test('channelBaseline: empty data → 0 (no division by zero)', async () => {
  const supabase = makeSupabaseMock({
    video_metrics: { data: [], error: null },
  })
  const r = await computeChannelBaseline(supabase as unknown as never, 'UC_empty', 30)
  assertEquals(r, 0)
})

Deno.test('channelBaseline: filter shape — eq channel_id and gte computed_at window', async () => {
  const supabase = makeSupabaseMock({
    video_metrics: { data: [{ views_per_hour: 5 }], error: null },
  })
  await computeChannelBaseline(supabase as unknown as never, 'UC_X', 7)
  const call = supabase.recorded[0]
  assertEquals(call.table, 'video_metrics')
  // Must filter by channel_id
  const eqs = call.filters.filter(f => f.op === 'eq')
  assertEquals(eqs.some(f => f.col === 'channel_id' && f.val === 'UC_X'), true)
  // Must apply a date-window gte on a computed_at-style column
  const gtes = call.filters.filter(f => f.op === 'gte')
  assertEquals(gtes.length >= 1, true)
})

// ─── computeNicheBaseline ────────────────────────────────────────────

Deno.test('nicheBaseline: aggregates across category — median of [10,20,30] = 20', async () => {
  // Two-step query (channels in category, then metrics in those channels)
  // OR single .eq('category', cat) on video_metrics. Either is fine; we
  // assert the resulting median, not the exact query plan.
  const supabase = makeSupabaseMock({
    video_metrics: {
      data: [
        { views_per_hour: 10 },
        { views_per_hour: 20 },
        { views_per_hour: 30 },
      ],
      error: null,
    },
  })
  const r = await computeNicheBaseline(supabase as unknown as never, 'ai_tools', 30)
  assertAlmostEquals(r, 20, 0.001)
})

Deno.test('nicheBaseline: empty data → 0 (no division by zero)', async () => {
  const supabase = makeSupabaseMock({
    video_metrics: { data: [], error: null },
  })
  const r = await computeNicheBaseline(supabase as unknown as never, 'crypto', 30)
  assertEquals(r, 0)
})

Deno.test('nicheBaseline: filter shape — category equality on video_metrics', async () => {
  const supabase = makeSupabaseMock({
    video_metrics: { data: [{ views_per_hour: 5 }], error: null },
  })
  await computeNicheBaseline(supabase as unknown as never, 'finance', 30)
  // At least one query must select from video_metrics with an eq on category=finance
  const vmCalls = supabase.recorded.filter(c => c.table === 'video_metrics')
  assertEquals(vmCalls.length >= 1, true)
  const hasCategoryFilter = vmCalls.some(c =>
    c.filters.some(f => f.op === 'eq' && f.col === 'category' && f.val === 'finance')
  )
  assertEquals(hasCategoryFilter, true)
})

Deno.test('channelBaseline: even count → average of two middle values', async () => {
  // [1, 2, 3, 4] → median = (2+3)/2 = 2.5
  const supabase = makeSupabaseMock({
    video_metrics: {
      data: [
        { views_per_hour: 4 },
        { views_per_hour: 1 },
        { views_per_hour: 3 },
        { views_per_hour: 2 },
      ],
      error: null,
    },
  })
  const r = await computeChannelBaseline(supabase as unknown as never, 'UC_even', 30)
  assertAlmostEquals(r, 2.5, 0.001)
})

Deno.test('channelBaseline: ignores NULL/non-finite values defensively', async () => {
  // Only [10, 20] are usable → median = 15
  const supabase = makeSupabaseMock({
    video_metrics: {
      data: [
        { views_per_hour: null },
        { views_per_hour: 10 },
        { views_per_hour: 'not a number' },
        { views_per_hour: 20 },
      ],
      error: null,
    },
  })
  const r = await computeChannelBaseline(supabase as unknown as never, 'UC_dirty', 30)
  assertAlmostEquals(r, 15, 0.001)
})
