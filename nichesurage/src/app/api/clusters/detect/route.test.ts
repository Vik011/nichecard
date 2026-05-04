/**
 * @jest-environment node
 *
 * Sprint B Phase 5C — cron route tests.
 *
 * The supabase service client is fully stubbed via a chainable query-builder
 * mock that records every call. Detection logic (`detectReplicationClusters`)
 * is mocked too — Phase 5B has its own tests; here we only verify orchestration.
 */

jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: jest.fn(),
}))

jest.mock('@/lib/clusters/detect', () => ({
  detectReplicationClusters: jest.fn(),
}))

import { GET } from './route'
import { createServiceClient } from '@/lib/supabase/service'
import { detectReplicationClusters } from '@/lib/clusters/detect'
import type { ClusterCandidate } from '@/lib/clusters/detect'

type Mock = jest.Mock
const mockedCreateClient = createServiceClient as unknown as Mock
const mockedDetect = detectReplicationClusters as unknown as Mock

// ─── Supabase mock builder ─────────────────────────────────────────────
//
// Records every (table, op, payload) interaction. Per-table behaviour is
// overridable via `state.tableHandlers`.
//
// Returned object is a chainable Promise-like; `await` resolves to whatever
// the handler returns ({ data, error, count }).

interface CallLog {
  table: string
  op: string
  payload?: unknown
  filter?: Record<string, unknown>
}

interface MockState {
  calls: CallLog[]
  tableHandlers: Record<string, (op: string, ctx: any) => any>
  defaultSelect: any[]
}

function makeSupabaseMock(state: MockState) {
  const from = jest.fn((table: string) => {
    const ctx: any = { table, filter: {}, payload: undefined, logged: false }
    function logOnce() {
      if (ctx.logged) return
      ctx.logged = true
      state.calls.push({
        table,
        op: ctx.op ?? 'select',
        payload: ctx.payload,
        filter: { ...ctx.filter },
      })
    }
    const builder: any = {
      insert(payload: unknown) {
        ctx.payload = payload
        ctx.op = 'insert'
        return builder
      },
      upsert(payload: unknown, options?: unknown) {
        ctx.payload = payload
        ctx.upsertOptions = options
        ctx.op = 'upsert'
        return builder
      },
      update(payload: unknown) {
        ctx.payload = payload
        ctx.op = 'update'
        return builder
      },
      delete(opts?: { count?: string }) {
        ctx.deleteOptions = opts
        ctx.op = 'delete'
        return builder
      },
      select(_cols?: string) {
        if (!ctx.op) ctx.op = 'select'
        return builder
      },
      eq(col: string, val: unknown) {
        ctx.filter[col] = val
        return builder
      },
      gt(col: string, val: unknown) {
        ctx.filter[`${col}__gt`] = val
        return builder
      },
      lt(col: string, val: unknown) {
        ctx.filter[`${col}__lt`] = val
        return builder
      },
      in(col: string, vals: unknown[]) {
        ctx.filter[`${col}__in`] = vals
        return builder
      },
      is(col: string, val: unknown) {
        ctx.filter[`${col}__is`] = val
        return builder
      },
      not(col: string, _op: string, val: unknown) {
        ctx.filter[`${col}__not`] = val
        return builder
      },
      order(_col: string, _opts?: unknown) {
        return builder
      },
      limit(_n: number) {
        return builder
      },
      maybeSingle() {
        ctx.single = 'maybe'
        return resolve()
      },
      single() {
        ctx.single = 'one'
        return resolve()
      },
      then(onFulfilled: (v: any) => any, onRejected?: (e: any) => any) {
        return resolve().then(onFulfilled, onRejected)
      },
    }
    function resolve() {
      logOnce()
      const handler = state.tableHandlers[table]
      const result = handler ? handler(ctx.op ?? 'select', ctx) : { data: state.defaultSelect, error: null, count: 0 }
      return Promise.resolve(result)
    }
    return builder
  })
  return { from }
}

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://example.test/api/clusters/detect', { headers })
}

beforeEach(() => {
  jest.resetAllMocks()
  // Stub global fetch (Anthropic) — overridden per-test where needed.
  ;(global as any).fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      content: [{ type: 'text', text: '{"archetype_id":"ai_money","display_label":"AI Money","is_new":false}' }],
    }),
    text: async () => '',
  }))
})

afterEach(() => {
  delete process.env.CRON_SECRET
  delete process.env.ANTHROPIC_API_KEY
})

// ─── Tests ─────────────────────────────────────────────────────────────

describe('GET /api/clusters/detect — auth', () => {
  it('returns 401 when CRON_SECRET set and no auth header', async () => {
    process.env.CRON_SECRET = 'sekret'
    const state: MockState = { calls: [], tableHandlers: {}, defaultSelect: [] }
    mockedCreateClient.mockReturnValue(makeSupabaseMock(state))
    mockedDetect.mockResolvedValue([])

    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns 200 with correct bearer token + empty detection', async () => {
    process.env.CRON_SECRET = 'sekret'
    const state: MockState = {
      calls: [],
      tableHandlers: {
        trend_clusters: (op) => {
          if (op === 'delete') return { data: null, error: null, count: 0 }
          if (op === 'update') return { data: null, error: null, count: 0 }
          return { data: [], error: null, count: 0 }
        },
      },
      defaultSelect: [],
    }
    mockedCreateClient.mockReturnValue(makeSupabaseMock(state))
    mockedDetect.mockResolvedValue([])

    const res = await GET(makeRequest({ authorization: 'Bearer sekret' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})

// Helper: build a ClusterCandidate of N members.
function fakeCluster(n: number, prefix = 'v'): ClusterCandidate {
  return {
    centroidVideoId: `${prefix}1`,
    members: Array.from({ length: n }, (_, i) => ({
      videoId: `${prefix}${i + 1}`,
      similarity: 0.9 - i * 0.01,
    })),
    distinctChannelCount: n,
  }
}

describe('GET /api/clusters/detect — persistence', () => {
  it('inserts trend_clusters once + writes 5 trend_cluster_members', async () => {
    process.env.ANTHROPIC_API_KEY = 'k'
    const cluster = fakeCluster(5)
    let detectCalls = 0
    mockedDetect.mockImplementation(async () => {
      detectCalls++
      return detectCalls === 1 ? [cluster] : [] // only first category returns a cluster
    })

    let nextId = 1
    const state: MockState = {
      calls: [],
      tableHandlers: {
        trend_clusters: (op) => {
          if (op === 'insert') return { data: { id: nextId++ }, error: null }
          if (op === 'delete') return { data: null, error: null, count: 0 }
          if (op === 'update') return { data: null, error: null, count: 0 }
          return { data: [], error: null }
        },
        trend_cluster_members: () => ({ data: null, error: null }),
        video_metrics: () => ({ data: [], error: null }),
        video_snapshots: () => ({
          data: cluster.members.map((m) => ({ video_id: m.videoId, title: `title ${m.videoId}`, scanned_at: '2026-01-01' })),
          error: null,
        }),
        narrative_archetypes: (op) => {
          if (op === 'select') return { data: { id: 'ai_money', detection_count: 0, status: 'canonical' }, error: null }
          return { data: null, error: null }
        },
      },
      defaultSelect: [],
    }
    mockedCreateClient.mockReturnValue(makeSupabaseMock(state))

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)

    const inserts = state.calls.filter((c) => c.table === 'trend_clusters' && c.op === 'insert')
    expect(inserts).toHaveLength(1)
    const insertedRow = inserts[0].payload as any
    expect(insertedRow.video_count).toBe(5)
    expect(insertedRow.channel_count).toBe(5)
    expect(insertedRow.is_mega_cluster).toBe(false)

    const memUpserts = state.calls.filter((c) => c.table === 'trend_cluster_members' && c.op === 'upsert')
    expect(memUpserts).toHaveLength(1)
    const memberRows = memUpserts[0].payload as any[]
    expect(memberRows).toHaveLength(5)
    expect(memberRows[0]).toMatchObject({ cluster_id: 1, video_id: 'v1' })
  })
})

describe('GET /api/clusters/detect — archetype matching', () => {
  it('canonical match path: increments detection_count + sets archetype on cluster', async () => {
    process.env.ANTHROPIC_API_KEY = 'k'
    const cluster = fakeCluster(5)
    let detectCalls = 0
    mockedDetect.mockImplementation(async () => {
      detectCalls++
      return detectCalls === 1 ? [cluster] : []
    })
    ;(global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: JSON.stringify({ archetype_id: 'ai_money', display_label: 'AI Money', is_new: false }) }],
      }),
      text: async () => '',
    }))

    const state: MockState = {
      calls: [],
      tableHandlers: {
        trend_clusters: (op) => {
          if (op === 'insert') return { data: { id: 7 }, error: null }
          if (op === 'delete') return { data: null, error: null, count: 0 }
          return { data: [], error: null, count: 0 }
        },
        trend_cluster_members: () => ({ data: null, error: null }),
        video_metrics: () => ({ data: [], error: null }),
        video_snapshots: () => ({
          data: cluster.members.map((m) => ({ video_id: m.videoId, title: `t ${m.videoId}`, scanned_at: '2026-01-01' })),
          error: null,
        }),
        narrative_archetypes: (op) => {
          if (op === 'select') return { data: { id: 'ai_money', detection_count: 4, status: 'canonical' }, error: null }
          return { data: null, error: null }
        },
      },
      defaultSelect: [],
    }
    mockedCreateClient.mockReturnValue(makeSupabaseMock(state))

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)

    const archetypeUpdates = state.calls.filter(
      (c) => c.table === 'narrative_archetypes' && c.op === 'update',
    )
    expect(archetypeUpdates.length).toBeGreaterThan(0)
    const incrementCall = archetypeUpdates.find((c) => (c.payload as any).detection_count === 5)
    expect(incrementCall).toBeDefined()

    const clusterUpdates = state.calls.filter(
      (c) =>
        c.table === 'trend_clusters' &&
        c.op === 'update' &&
        (c.payload as any).narrative_archetype_id === 'ai_money',
    )
    expect(clusterUpdates.length).toBeGreaterThan(0)
  })

  it('candidate creation path: inserts new archetype with status=candidate', async () => {
    process.env.ANTHROPIC_API_KEY = 'k'
    const cluster = fakeCluster(5)
    let detectCalls = 0
    mockedDetect.mockImplementation(async () => {
      detectCalls++
      return detectCalls === 1 ? [cluster] : []
    })
    ;(global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: JSON.stringify({ archetype_id: 'silent_grift', display_label: 'Silent Grift', is_new: true }) }],
      }),
      text: async () => '',
    }))

    const state: MockState = {
      calls: [],
      tableHandlers: {
        trend_clusters: (op) => {
          if (op === 'insert') return { data: { id: 11 }, error: null }
          if (op === 'delete') return { data: null, error: null, count: 0 }
          return { data: [], error: null, count: 0 }
        },
        trend_cluster_members: () => ({ data: null, error: null }),
        video_metrics: () => ({ data: [], error: null }),
        video_snapshots: () => ({
          data: cluster.members.map((m) => ({ video_id: m.videoId, title: `t ${m.videoId}`, scanned_at: '2026-01-01' })),
          error: null,
        }),
        narrative_archetypes: (op) => {
          if (op === 'select') return { data: null, error: null } // not yet exists
          if (op === 'insert') return { data: null, error: null }
          return { data: null, error: null }
        },
      },
      defaultSelect: [],
    }
    mockedCreateClient.mockReturnValue(makeSupabaseMock(state))

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)

    const inserts = state.calls.filter(
      (c) => c.table === 'narrative_archetypes' && c.op === 'insert',
    )
    expect(inserts.length).toBeGreaterThan(0)
    const newRow = inserts[0].payload as any
    expect(newRow.id).toBe('silent_grift')
    expect(newRow.status).toBe('candidate')
    expect(newRow.detection_count).toBe(1)
    expect(newRow.display_label).toBe('Silent Grift')
  })

  it('malformed Claude response: defensive fallback to education_howto', async () => {
    process.env.ANTHROPIC_API_KEY = 'k'
    const cluster = fakeCluster(5)
    let detectCalls = 0
    mockedDetect.mockImplementation(async () => {
      detectCalls++
      return detectCalls === 1 ? [cluster] : []
    })
    ;(global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'not json at all, just chatter' }] }),
      text: async () => '',
    }))

    const state: MockState = {
      calls: [],
      tableHandlers: {
        trend_clusters: (op) => {
          if (op === 'insert') return { data: { id: 22 }, error: null }
          if (op === 'delete') return { data: null, error: null, count: 0 }
          return { data: [], error: null, count: 0 }
        },
        trend_cluster_members: () => ({ data: null, error: null }),
        video_metrics: () => ({ data: [], error: null }),
        video_snapshots: () => ({
          data: cluster.members.map((m) => ({ video_id: m.videoId, title: `t ${m.videoId}`, scanned_at: '2026-01-01' })),
          error: null,
        }),
        narrative_archetypes: (op) => {
          if (op === 'select')
            return { data: { id: 'education_howto', detection_count: 0, status: 'canonical' }, error: null }
          return { data: null, error: null }
        },
      },
      defaultSelect: [],
    }
    mockedCreateClient.mockReturnValue(makeSupabaseMock(state))

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)

    const clusterUpdates = state.calls.filter(
      (c) =>
        c.table === 'trend_clusters' &&
        c.op === 'update' &&
        (c.payload as any).narrative_archetype_id === 'education_howto',
    )
    expect(clusterUpdates.length).toBeGreaterThan(0)
  })
})

describe('GET /api/clusters/detect — cost cap', () => {
  it('25 clusters → only top 20 get Claude calls', async () => {
    process.env.ANTHROPIC_API_KEY = 'k'

    // Build 25 clusters with descending size so the top-20 filter is observable.
    const clusters: ClusterCandidate[] = []
    for (let i = 0; i < 25; i++) {
      const size = 5 + (25 - i) // 30 down to 6 → 25 distinct sizes
      clusters.push({
        centroidVideoId: `c${i}`,
        members: Array.from({ length: size }, (_, j) => ({ videoId: `c${i}_v${j}`, similarity: 0.9 })),
        distinctChannelCount: size,
      })
    }
    let detectCalls = 0
    mockedDetect.mockImplementation(async () => {
      detectCalls++
      return detectCalls === 1 ? clusters : []
    })

    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: JSON.stringify({ archetype_id: 'ai_money', display_label: 'AI Money', is_new: false }) }],
      }),
      text: async () => '',
    }))
    ;(global as any).fetch = fetchMock

    let nextId = 100
    const state: MockState = {
      calls: [],
      tableHandlers: {
        trend_clusters: (op) => {
          if (op === 'insert') return { data: { id: nextId++ }, error: null }
          if (op === 'delete') return { data: null, error: null, count: 0 }
          return { data: [], error: null, count: 0 }
        },
        trend_cluster_members: () => ({ data: null, error: null }),
        video_metrics: () => ({ data: [], error: null }),
        video_snapshots: (_op, ctx) => {
          // Return one snapshot per requested video_id so every cluster
          // has titles available for the archetype prompt.
          const ids = (ctx.filter?.video_id__in ?? []) as string[]
          return {
            data: ids.map((id) => ({ video_id: id, title: `t ${id}`, scanned_at: '2026-01-01' })),
            error: null,
          }
        },
        narrative_archetypes: (op) => {
          if (op === 'select') return { data: { id: 'ai_money', detection_count: 0, status: 'canonical' }, error: null }
          return { data: null, error: null }
        },
      },
      defaultSelect: [],
    }
    mockedCreateClient.mockReturnValue(makeSupabaseMock(state))

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)

    expect(fetchMock).toHaveBeenCalledTimes(20)
  })
})

describe('GET /api/clusters/detect — mega-cluster detection', () => {
  it('3 clusters in 3 categories with same archetype → all flagged is_mega_cluster', async () => {
    process.env.ANTHROPIC_API_KEY = 'k'
    mockedDetect.mockResolvedValue([])

    const state: MockState = {
      calls: [],
      tableHandlers: {
        trend_clusters: (op, ctx) => {
          // The flagMegaClusters fetch reads narrative_archetype_id + category for
          // the not-null + last-7d slice.
          if (
            op === 'select' &&
            ctx.filter['narrative_archetype_id__not'] !== undefined
          ) {
            return {
              data: [
                { narrative_archetype_id: 'hidden_wealth', category: 'finance' },
                { narrative_archetype_id: 'hidden_wealth', category: 'crypto' },
                { narrative_archetype_id: 'hidden_wealth', category: 'self_improvement' },
              ],
              error: null,
            }
          }
          if (op === 'delete') return { data: null, error: null, count: 0 }
          if (op === 'update') return { data: null, error: null, count: 0 }
          return { data: [], error: null, count: 0 }
        },
        trend_cluster_members: () => ({ data: null, error: null }),
        video_metrics: () => ({ data: [], error: null }),
        video_snapshots: () => ({ data: [], error: null }),
        narrative_archetypes: () => ({ data: null, error: null }),
      },
      defaultSelect: [],
    }
    mockedCreateClient.mockReturnValue(makeSupabaseMock(state))

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)

    const megaUpdates = state.calls.filter(
      (c) =>
        c.table === 'trend_clusters' &&
        c.op === 'update' &&
        (c.payload as any).is_mega_cluster === true,
    )
    expect(megaUpdates.length).toBeGreaterThan(0)
    const u = megaUpdates[0]
    const cats = (u.payload as any).mega_cluster_categories as string[]
    expect(cats).toEqual(expect.arrayContaining(['finance', 'crypto', 'self_improvement']))
    expect((u.filter as any).narrative_archetype_id).toBe('hidden_wealth')
  })
})
