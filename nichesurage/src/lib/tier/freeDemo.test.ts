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
  }
}

function makeCandidateBuilder(state: {
  candidates: CandidateRow[]
  candidateError?: boolean
  allowedChannelIds?: string[]
}) {
  return {
    select(_cols: string) {
      const builder = {
        eq(_col: string, _value: unknown) {
          return builder
        },
        in(_col: string, _values: unknown) {
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
          const allowed = state.allowedChannelIds ?? state.candidates.map((c) => c.youtube_channel_id)
          const pool = state.candidates.filter((c) => allowed.includes(c.youtube_channel_id))
          return { data: pool.slice(0, n), error: null }
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

  it('returns the existing pinned row with justInserted=false for subsequent same-day calls', async () => {
    const state = {
      pins: [
        {
          date: '2026-05-07',
          scan_result_id: 'pinned-yesterday-overflow',
          youtube_channel_id: 'UC_pinned',
        },
      ],
      candidates: SAMPLE_CANDIDATES, // Different "top" — but pinned row wins.
    }
    const client = makeMockClient(state)

    const result = await getDailyDemoNiche(asSupabase(client), { now: FIXED_DAY_UTC })

    expect(result).toEqual({
      scanResultId: 'pinned-yesterday-overflow',
      youtubeChannelId: 'UC_pinned',
      justInserted: false,
    })
    expect(state.pins).toHaveLength(1) // No second insert.
  })

  it('every same-day call returns the same scan even if the candidate pool churns', async () => {
    const state = { pins: [] as PinRow[], candidates: SAMPLE_CANDIDATES }
    const client = makeMockClient(state)

    const first = await getDailyDemoNiche(asSupabase(client), { now: FIXED_DAY_UTC })

    // Simulate the spike pool changing during the day (top niche dropped).
    state.candidates = [
      { id: 'niche-different', youtube_channel_id: 'UC_diff', niche_clusters: { id: 'c4', label: 'Other' } },
      ...SAMPLE_CANDIDATES.slice(1),
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

  it('survives a parallel-writer race (PK collision) by re-reading the winner with justInserted=false', async () => {
    const winnerRow: PinRow = {
      date: '2026-05-07',
      scan_result_id: 'race-winner',
      youtube_channel_id: 'UC_winner',
    }
    const state = {
      pins: [winnerRow], // Winner already wrote.
      candidates: SAMPLE_CANDIDATES,
      insertCollision: true,
    }
    const client = makeMockClient(state)

    const result = await getDailyDemoNiche(asSupabase(client), { now: FIXED_DAY_UTC })

    expect(result).toEqual({
      scanResultId: 'race-winner',
      youtubeChannelId: 'UC_winner',
      justInserted: false,
    })
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
})
