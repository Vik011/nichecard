jest.mock('@/lib/supabase/staticClient', () => ({
  createStaticClient: jest.fn(),
}))

import { createStaticClient } from '@/lib/supabase/staticClient'
import { fetchRadarPings } from './fetchRadarPings'

const mockCreateStaticClient = createStaticClient as jest.MockedFunction<typeof createStaticClient>

// Rows as returned by the public_landing_niches() RPC. Note there is NO label
// column — the radar derives a coarse content-type label locally, so there is
// nothing here that could leak a real niche/cluster name.
const rpcRows = [
  { id: 'p1', outlier_ratio: 12.5, language: 'en', content_type: 'longform' },
  { id: 'p2', outlier_ratio: 7.0, language: 'de', content_type: 'shorts' },
]

// Static-client mock. `.rpc()` returns the ping-pool builder (terminal
// `.limit()` resolves to {data}) or the count builder (awaitable, resolves to
// {count}) depending on the head option. `from` must NEVER be called — that is
// the regression guard proving niche_clusters is no longer hydrated.
function mockClient(
  rows: unknown,
  count: number,
  opts: { rowsError?: unknown; countError?: unknown } = {},
) {
  const poolBuilder: Record<string, jest.Mock> = {}
  poolBuilder.select = jest.fn(() => poolBuilder)
  poolBuilder.eq = jest.fn(() => poolBuilder)
  poolBuilder.gte = jest.fn(() => poolBuilder)
  poolBuilder.not = jest.fn(() => poolBuilder)
  poolBuilder.order = jest.fn(() => poolBuilder)
  poolBuilder.limit = jest.fn(() => Promise.resolve({ data: rows, error: opts.rowsError ?? null }))

  const countResult = { count, error: opts.countError ?? null }
  const countBuilder: Record<string, unknown> = {}
  countBuilder.eq = jest.fn(() => countBuilder)
  countBuilder.gte = jest.fn(() => countBuilder)
  countBuilder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(countResult).then(resolve)

  const rpc = jest.fn((_name: string, _args?: unknown, options?: { head?: boolean }) =>
    options?.head ? countBuilder : poolBuilder,
  )
  const from = jest.fn()

  mockCreateStaticClient.mockReturnValue({
    rpc,
    from,
  } as unknown as ReturnType<typeof createStaticClient>)
  return { rpc, from }
}

describe('fetchRadarPings — coarse, redacted radar labels', () => {
  it('derives a coarse content-type label, never a real niche/cluster label', async () => {
    mockClient(rpcRows, 9)
    const { pings } = await fetchRadarPings()
    expect(pings.map((p) => p.clusterLabel)).toEqual(['Faceless Long-form', 'Faceless Shorts'])
    for (const p of pings) {
      expect(['Faceless Shorts', 'Faceless Long-form', 'Hidden niche']).toContain(p.clusterLabel)
    }
  })

  it('does NOT hydrate niche_clusters (no .from() on the landing path)', async () => {
    const { from } = mockClient(rpcRows, 9)
    await fetchRadarPings()
    expect(from).not.toHaveBeenCalled()
  })

  it('uses the safe public_landing_niches RPC for both the ping pool and the count', async () => {
    const { rpc } = mockClient(rpcRows, 42)
    const snapshot = await fetchRadarPings()
    expect(rpc).toHaveBeenCalledWith('public_landing_niches')
    expect(rpc).toHaveBeenCalledWith('public_landing_niches', undefined, { count: 'exact', head: true })
    expect(snapshot.channelsLast24h).toBe(42)
  })

  it('returns an empty snapshot on RPC error', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockClient(null, 0, { rowsError: { message: 'boom' } })
    const snapshot = await fetchRadarPings()
    expect(snapshot).toEqual({ pings: [], channelsLast24h: 0 })
    spy.mockRestore()
  })
})
