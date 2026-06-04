/* eslint-disable @typescript-eslint/no-unused-vars -- mock query builders ignore their args */
import type { SupabaseClient } from '@supabase/supabase-js'

import { getDailyDemoNiche, utcDateKey } from './freeDemo'

type SupabaseLike = Pick<SupabaseClient, 'from'>
const asSupabase = (m: unknown): SupabaseLike => m as SupabaseLike

const FIXED_DAY_UTC = new Date('2026-05-07T10:00:00.000Z')

interface PinRow {
  date: string
  scan_result_id: string
  youtube_channel_id: string
}

interface CandidateRow {
  id: string
  youtube_channel_id: string
  niche_clusters: { id: string; label: string }
}

/**
 * Minimal Supabase client mock that mimics the chained query patterns we
 * actually use. Each test seeds it with a fresh state.
 */
function makeMockClient(state: {
  pins: PinRow[]
  candidates: CandidateRow[]
  /** When true, the next insert collides on the date PK. */
  insertCollision?: boolean
  /** When true, INSERT throws a generic DB error. */
  insertGenericError?: boolean
  /** When true, the candidate SELECT fails. */
  candidateError?: boolean
  /** When true, the pin SELECT fails. */
  pinReadError?: boolean
  /**
   * Faceless gate result. Defaults to every candidate's channel id (so the
   * gate is a no-op for legacy tests). Set explicitly to test that the demo
   * pick is restricted to faceless+active+not-evicted channels.
   */
  allowedChannelIds?: string[]
}) {
  return {
    from(table: string) {
      if (table === 'daily_demo_niche') {
        return makeDailyDemoBuilder(state)
      }
      if (table === 'channels_watchlist') {
        return makeWatchlistBuilder(state)
      }
      if (table === 'scan_results_latest') {
        return makeCandidateBuilder(state)
      }
      throw new Error(`Unexpected table in mock: ${table}`)
    },
  }
}

// getAllowedChannelIds() reads channels_watchlist with the faceless gate.
// Resolve to the configured allow-list (default: every candidate channel id).
function makeWatchlistBuilder(state: {
  candidates: CandidateRow[]
  allowedChannelIds?: string[]
}) {
  const ids = state.allowedChannelIds ?? state.candidates.map((c) => c.youtube_channel_id)
  const builder = {
    select(_cols: string) {
      return builder
    },
    eq(_col: string, _value: unknown) {
      return builder
    },
    is(_col: string, _value: unknown) {
      return builder
    },
    in(_col: string, _values: unknown) {
      return builder
    },
    then(onFulfilled: (r: { data: unknown; error: unknown }) => unknown) {
      return Promise.resolve({
        data: ids.map((id) => ({ youtube_channel_id: id })),
        error: null,
      }).then(onFulfilled)
    },
  }
  return builder
}

function makeDailyDemoBuilder(state: {
  pins: PinRow[]
  insertCollision?: boolean
  insertGenericError?: boolean
  pinReadError?: boolean
  /** When true, the replacement UPDATE returns a DB error. */
  replaceError?: boolean
  /** When true, the replacement UPDATE confirms no row (unconfirmed write). */
  replaceMissingRow?: boolean
}) {
  return {
    select(_cols: string) {
      let dateFilter: string | null = null
      const builder = {
        eq(_col: string, value: string) {
          dateFilter = value
          return builder
        },
        async maybeSingle() {
          if (state.pinReadError) {
            return { data: null, error: { message: 'read failed' } }
          }
          const row = state.pins.find((p) => p.date === dateFilter) ?? null
          return { data: row, error: null }
        },
      }
      return builder
    },
    async insert(row: PinRow) {
      if (state.insertGenericError) {
        return { error: { code: '42P01', message: 'table missing' } }
      }
      if (state.insertCollision) {
        // After a collision a parallel writer's row should be readable.
        // Tests opting into collision must seed `pins` with the winner.
        return { error: { code: '23505', message: 'duplicate key' } }
      }
      state.pins.push(row)
      return { error: null }
    },
    // replacePin(): update(...).eq('date', dateKey).select().maybeSingle().
    // Returns the persisted row so the caller can CONFIRM the write landed;
    // a null row means the replacement is unconfirmed and must fail closed.
    update(values: { scan_result_id?: string; youtube_channel_id?: string; picked_at?: string }) {
      let dateFilter: string | null = null
      const builder = {
        eq(_col: string, value: string) {
          dateFilter = value
          return builder
        },
        select(_cols: string) {
          return builder
        },
        async maybeSingle() {
          if (state.replaceError) {
            return { data: null, error: { message: 'update failed' } }
          }
          const row = state.pins.find((p) => p.date === dateFilter)
          if (!row || state.replaceMissingRow) {
            // No row matched / RLS no-op → unconfirmed write.
            return { data: null, error: null }
          }
          if (values.scan_result_id) row.scan_result_id = values.scan_result_id
          if (values.youtube_channel_id) row.youtube_channel_id = values.youtube_channel_id
          return { data: { scan_result_id: row.scan_result_id }, error: null }
        },
      }
      return builder
    },
  }
}

function makeCandidateBuilder(state: {
  candidates: CandidateRow[]
  candidateError?: boolean
  allowedChannelIds?: string[]
}) {
  return {
    select(_cols: string) {
      // pickCandidate uses .eq('is_spike', true); pinStillResolvable uses
      // .eq('id', scanResultId). Track only the id filter — the gate is the
      // .in('youtube_channel_id', allowedIds) clause below.
      let idFilter: string | null = null
      let inAllowed: string[] | null = null
      const allowedFor = () =>
        inAllowed ?? state.allowedChannelIds ?? state.candidates.map((c) => c.youtube_channel_id)
      const builder = {
        eq(col: string, value: unknown) {
          if (col === 'id') idFilter = String(value)
          return builder
        },
        in(_col: string, values: unknown) {
          inAllowed = values as string[]
          return builder
        },
        order(_col: string, _opts: unknown) {
          return builder
        },
        async limit(n: number) {
          if (state.candidateError) {
            return { data: null, error: { message: 'candidate fetch failed' } }
          }
          // Simulate the .in('youtube_channel_id', allowedIds) gate: only
          // candidates whose channel is allowed survive.
          const allowed = allowedFor()
          const pool = state.candidates.filter((c) => allowed.includes(c.youtube_channel_id))
          return { data: pool.slice(0, n), error: null }
        },
        // pinStillResolvable(): does scanResultId still exist in
        // scan_results_latest for an allowed (faceless) channel?
        async maybeSingle() {
          if (state.candidateError) {
            return { data: null, error: { message: 'candidate fetch failed' } }
          }
          const allowed = allowedFor()
          const row =
            state.candidates.find(
              (c) => c.id === idFilter && allowed.includes(c.youtube_channel_id),
            ) ?? null
          return { data: row ? { id: row.id } : null, error: null }
        },
      }
      return builder
    },
  }
}

const SAMPLE_CANDIDATES: CandidateRow[] = [
  { id: 'niche-top', youtube_channel_id: 'UC_top', niche_clusters: { id: 'c1', label: 'AI Agents' } },
  { id: 'niche-second', youtube_channel_id: 'UC_second', niche_clusters: { id: 'c2', label: 'Stoic Daily' } },
  { id: 'niche-third', youtube_channel_id: 'UC_third', niche_clusters: { id: 'c3', label: 'Faceless YT' } },
]

describe('utcDateKey', () => {
  it('formats as YYYY-MM-DD using UTC, not local time', () => {
    expect(utcDateKey(new Date('2026-05-07T23:59:59.999Z'))).toBe('2026-05-07')
    expect(utcDateKey(new Date('2026-05-08T00:00:00.000Z'))).toBe('2026-05-08')
  })
})

describe('getDailyDemoNiche', () => {
  it('inserts a fresh pick on the first call of the day and returns it with justInserted=true', async () => {
    const state = { pins: [] as PinRow[], candidates: SAMPLE_CANDIDATES }
    const client = makeMockClient(state)

    const result = await getDailyDemoNiche(asSupabase(client), { now: FIXED_DAY_UTC })

    expect(result).toEqual({ scanResultId: 'niche-top', youtubeChannelId: 'UC_top', justInserted: true })
    expect(state.pins).toHaveLength(1)
    expect(state.pins[0].date).toBe('2026-05-07')
  })

  it('returns the existing (still-valid) pinned row with justInserted=false for subsequent same-day calls', async () => {
    const state = {
      // A valid faceless pin that is NOT the candidate top (niche-top): the
      // pinned row must win over the live top on same-day reads, and it must
      // pass revalidation (its id resolves in scan_results_latest).
      pins: [
        {
          date: '2026-05-07',
          scan_result_id: 'niche-third',
          youtube_channel_id: 'UC_third',
        },
      ],
      candidates: SAMPLE_CANDIDATES,
    }
    const client = makeMockClient(state)

    const result = await getDailyDemoNiche(asSupabase(client), { now: FIXED_DAY_UTC })

    expect(result).toEqual({
      scanResultId: 'niche-third',
      youtubeChannelId: 'UC_third',
      justInserted: false,
    })
    expect(state.pins).toHaveLength(1) // No second insert.
    expect(state.pins[0].scan_result_id).toBe('niche-third') // Unchanged: no replacement.
  })

  it('every same-day call returns the same scan when the pinned row still resolves, even as the pool reorders', async () => {
    const state = { pins: [] as PinRow[], candidates: SAMPLE_CANDIDATES }
    const client = makeMockClient(state)

    const first = await getDailyDemoNiche(asSupabase(client), { now: FIXED_DAY_UTC })

    // A hotter niche appears on top, but the pinned channel's row is STILL in
    // scan_results_latest — so revalidation passes and the pin stays stable
    // (no replacement). (A pinned row that DROPS OUT of the latest view is a
    // separate case, covered by the stale-id replacement test below.)
    state.candidates = [
      { id: 'niche-different', youtube_channel_id: 'UC_diff', niche_clusters: { id: 'c4', label: 'Other' } },
      ...SAMPLE_CANDIDATES,
    ]

    const second = await getDailyDemoNiche(
      asSupabase(client),
      { now: new Date('2026-05-07T18:00:00.000Z') },
    )
    // The pinned scan must be identical across same-day calls. The
    // justInserted flag legitimately differs (true on the call that did
    // the INSERT, false on every read after) — that's what lets the
    // auth callback decide when to fire the AI pre-warm.
    expect(second?.scanResultId).toBe(first?.scanResultId)
    expect(second?.youtubeChannelId).toBe(first?.youtubeChannelId)
    expect(first?.justInserted).toBe(true)
    expect(second?.justInserted).toBe(false)
  })

  it('returns a pre-existing valid pinned row (parallel-writer winner) with justInserted=false', async () => {
    // A parallel writer already pinned today's row with a valid faceless pick.
    // readPinned finds it first, so the INSERT/collision branch is never
    // reached; revalidation passes and we return the winner unchanged.
    const winnerRow: PinRow = {
      date: '2026-05-07',
      scan_result_id: 'niche-second',
      youtube_channel_id: 'UC_second',
    }
    const state = {
      pins: [winnerRow],
      candidates: SAMPLE_CANDIDATES,
      insertCollision: true,
    }
    const client = makeMockClient(state)

    const result = await getDailyDemoNiche(asSupabase(client), { now: FIXED_DAY_UTC })

    expect(result).toEqual({
      scanResultId: 'niche-second',
      youtubeChannelId: 'UC_second',
      justInserted: false,
    })
    expect(state.pins).toHaveLength(1)
  })

  it('returns null when the candidate pool is empty (cold start)', async () => {
    const state = { pins: [] as PinRow[], candidates: [] }
    const client = makeMockClient(state)

    const result = await getDailyDemoNiche(asSupabase(client), { now: FIXED_DAY_UTC })

    expect(result).toBeNull()
  })

  it('returns null when the candidate read errors out', async () => {
    const state = {
      pins: [] as PinRow[],
      candidates: SAMPLE_CANDIDATES,
      candidateError: true,
    }
    const client = makeMockClient(state)

    const result = await getDailyDemoNiche(asSupabase(client), { now: FIXED_DAY_UTC })

    expect(result).toBeNull()
  })

  it('returns null on generic INSERT failure (does not crash)', async () => {
    const state = {
      pins: [] as PinRow[],
      candidates: SAMPLE_CANDIDATES,
      insertGenericError: true,
    }
    const client = makeMockClient(state)

    const result = await getDailyDemoNiche(asSupabase(client), { now: FIXED_DAY_UTC })

    expect(result).toBeNull()
  })

  it('rolls over to a new day at UTC midnight', async () => {
    const state = { pins: [] as PinRow[], candidates: SAMPLE_CANDIDATES }
    const client = makeMockClient(state)

    await getDailyDemoNiche(asSupabase(client), { now: new Date('2026-05-07T23:59:00.000Z') })
    await getDailyDemoNiche(asSupabase(client), { now: new Date('2026-05-08T00:01:00.000Z') })

    expect(state.pins.map((p) => p.date).sort()).toEqual(['2026-05-07', '2026-05-08'])
  })

  it('restricts the daily pick to faceless+active+not-evicted channels (faceless gate)', async () => {
    // The top candidate (UC_top) is NOT faceless-allowed, so the next allowed
    // candidate must be chosen as the demo niche instead.
    const state = {
      pins: [] as PinRow[],
      candidates: SAMPLE_CANDIDATES,
      allowedChannelIds: ['UC_second', 'UC_third'], // UC_top excluded by the gate
    }
    const client = makeMockClient(state)

    const result = await getDailyDemoNiche(asSupabase(client), { now: FIXED_DAY_UTC })

    expect(result?.youtubeChannelId).toBe('UC_second')
    expect(result?.scanResultId).toBe('niche-second')
  })

  it('returns null when no candidate passes the faceless gate', async () => {
    const state = {
      pins: [] as PinRow[],
      candidates: SAMPLE_CANDIDATES,
      allowedChannelIds: [], // gate resolves empty → no faceless channels
    }
    const client = makeMockClient(state)

    const result = await getDailyDemoNiche(asSupabase(client), { now: FIXED_DAY_UTC })

    expect(result).toBeNull()
  })

  // --- Stored-pin revalidation (PR #112 faceless gate hotfix) ------------
  // A pin written before the gate (or whose channel/scan has since gone
  // invalid) must NOT be served as-is — it would no longer resolve via the
  // gated fetchNicheById and leave FREE users all-locked. getDailyDemoNiche
  // revalidates the stored pin and replaces it with a valid faceless pick.

  it('rejects a stored non-faceless pin and replaces it with a valid faceless pin (persisted, justInserted=true)', async () => {
    const state = {
      // Pin points at niche-top/UC_top, but UC_top is NOT faceless-allowed
      // (e.g. written by the pre-#112 ungated picker, or since evicted).
      pins: [
        { date: '2026-05-07', scan_result_id: 'niche-top', youtube_channel_id: 'UC_top' },
      ],
      candidates: SAMPLE_CANDIDATES,
      allowedChannelIds: ['UC_second', 'UC_third'], // UC_top excluded by the gate
    }
    const client = makeMockClient(state)

    const result = await getDailyDemoNiche(asSupabase(client), { now: FIXED_DAY_UTC })

    // Replaced with the top ALLOWED candidate (UC_second), and persisted.
    expect(result).toEqual({
      scanResultId: 'niche-second',
      youtubeChannelId: 'UC_second',
      justInserted: true,
    })
    expect(state.pins).toHaveLength(1)
    expect(state.pins[0].scan_result_id).toBe('niche-second')
    expect(state.pins[0].youtube_channel_id).toBe('UC_second')
    // No non-faceless channel exposed.
    expect(['UC_second', 'UC_third']).toContain(result?.youtubeChannelId)
  })

  it('rejects a stored pin whose scan_result_id is no longer the latest row (stale id) even when the channel is faceless', async () => {
    const state = {
      // UC_top IS faceless, but the pinned scan_result_id has been superseded
      // by a newer scan, so it no longer appears in scan_results_latest.
      pins: [
        { date: '2026-05-07', scan_result_id: 'niche-top-OLD', youtube_channel_id: 'UC_top' },
      ],
      candidates: SAMPLE_CANDIDATES, // current latest for UC_top is 'niche-top'
    }
    const client = makeMockClient(state)

    const result = await getDailyDemoNiche(asSupabase(client), { now: FIXED_DAY_UTC })

    expect(result).toEqual({
      scanResultId: 'niche-top',
      youtubeChannelId: 'UC_top',
      justInserted: true,
    })
    expect(state.pins[0].scan_result_id).toBe('niche-top') // persisted replacement
  })

  it('persists the replacement so the next same-day call returns it without re-picking (no loop)', async () => {
    const state = {
      pins: [
        { date: '2026-05-07', scan_result_id: 'niche-top-OLD', youtube_channel_id: 'UC_top' },
      ],
      candidates: SAMPLE_CANDIDATES,
    }
    const client = makeMockClient(state)

    const first = await getDailyDemoNiche(asSupabase(client), { now: FIXED_DAY_UTC })
    expect(first?.justInserted).toBe(true) // replaced this call
    expect(first?.scanResultId).toBe('niche-top')

    const second = await getDailyDemoNiche(
      asSupabase(client),
      { now: new Date('2026-05-07T20:00:00.000Z') },
    )
    // Second call reads the persisted, now-valid pin → no further replacement.
    expect(second).toEqual({
      scanResultId: 'niche-top',
      youtubeChannelId: 'UC_top',
      justInserted: false,
    })
    expect(state.pins).toHaveLength(1)
  })

  it('fails closed (null) when the replacement UPDATE errors — never returns a non-persisted pick', async () => {
    const state = {
      pins: [
        { date: '2026-05-07', scan_result_id: 'niche-INVALID', youtube_channel_id: 'UC_top' },
      ],
      candidates: SAMPLE_CANDIDATES,
      replaceError: true,
    }
    const client = makeMockClient(state)

    const result = await getDailyDemoNiche(asSupabase(client), { now: FIXED_DAY_UTC })

    expect(result).toBeNull()
    expect(state.pins[0].scan_result_id).toBe('niche-INVALID') // stored pin untouched
  })

  it('fails closed (null) when the replacement UPDATE confirms no row (unconfirmed write)', async () => {
    const state = {
      pins: [
        { date: '2026-05-07', scan_result_id: 'niche-INVALID', youtube_channel_id: 'UC_top' },
      ],
      candidates: SAMPLE_CANDIDATES,
      replaceMissingRow: true,
    }
    const client = makeMockClient(state)

    const result = await getDailyDemoNiche(asSupabase(client), { now: FIXED_DAY_UTC })

    expect(result).toBeNull()
  })

  it('returns null without crashing or looping when the pin is invalid and no faceless candidate exists', async () => {
    const state = {
      pins: [
        { date: '2026-05-07', scan_result_id: 'niche-INVALID', youtube_channel_id: 'UC_gone' },
      ],
      candidates: SAMPLE_CANDIDATES,
      allowedChannelIds: [], // empty faceless catalog
    }
    const client = makeMockClient(state)

    const result = await getDailyDemoNiche(asSupabase(client), { now: FIXED_DAY_UTC })

    expect(result).toBeNull()
    expect(state.pins[0].scan_result_id).toBe('niche-INVALID') // no replacement attempted
  })
})
