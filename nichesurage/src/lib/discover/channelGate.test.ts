import { getAllowedChannelIds } from './channelGate'

type Resolved = { data: unknown; error: unknown }

interface Chain {
  select: jest.Mock
  eq: jest.Mock
  is: jest.Mock
  in: jest.Mock
  then: (cb: (r: Resolved) => unknown) => Promise<unknown>
}

function makeChain(resolved: Resolved): Chain {
  const chain: Partial<Chain> = {}
  const ret = () => chain as Chain
  // Per-method jest.fns so tests can assert which predicates were applied.
  chain.select = jest.fn(ret)
  chain.eq = jest.fn(ret)
  chain.is = jest.fn(ret)
  chain.in = jest.fn(ret)
  chain.then = (onFulfilled) => Promise.resolve(resolved).then(onFulfilled)
  return chain as Chain
}

function makeClient(resolved: Resolved): {
  client: { from: jest.Mock }
  chains: Chain[]
} {
  const chains: Chain[] = []
  const client = {
    from: jest.fn((_table: string) => {
      const c = makeChain(resolved)
      chains.push(c)
      return c
    }),
  }
  return { client, chains }
}

describe('getAllowedChannelIds', () => {
  it('returns the faceless channel ids and applies the three gate predicates', async () => {
    const { client, chains } = makeClient({
      data: [{ youtube_channel_id: 'UCa' }, { youtube_channel_id: 'UCb' }],
      error: null,
    })
    const ids = await getAllowedChannelIds(client as never)
    expect(ids).toEqual(['UCa', 'UCb'])

    expect(client.from).toHaveBeenCalledWith('channels_watchlist')
    const c = chains[0]
    expect(c.eq).toHaveBeenCalledWith('faceless_verdict', 'faceless')
    expect(c.eq).toHaveBeenCalledWith('is_active', true)
    expect(c.is).toHaveBeenCalledWith('evicted_at', null)
  })

  it('applies a category filter when categories are provided', async () => {
    const { client, chains } = makeClient({ data: [], error: null })
    await getAllowedChannelIds(client as never, ['finance', 'tech_ai'])
    expect(chains[0].in).toHaveBeenCalledWith('category', ['finance', 'tech_ai'])
  })

  it('does NOT apply a category filter when none are provided', async () => {
    const { client, chains } = makeClient({ data: [], error: null })
    await getAllowedChannelIds(client as never)
    expect(chains[0].in).not.toHaveBeenCalled()
  })

  it('fails closed (returns []) on a query error', async () => {
    const { client } = makeClient({ data: null, error: { message: 'boom' } })
    expect(await getAllowedChannelIds(client as never)).toEqual([])
  })

  it('returns [] when data is null', async () => {
    const { client } = makeClient({ data: null, error: null })
    expect(await getAllowedChannelIds(client as never)).toEqual([])
  })
})
