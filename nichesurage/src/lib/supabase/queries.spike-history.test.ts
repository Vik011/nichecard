import { fetchSpikeHistory } from './queries'

const orderResolved = (data: unknown, error: unknown = null) =>
  jest.fn().mockResolvedValue({ data, error })

jest.mock('./client', () => ({
  createClient: jest.fn(),
}))

const { createClient } = jest.requireMock('./client') as { createClient: jest.Mock }

function mockChain(orderImpl: jest.Mock) {
  return {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: orderImpl,
        })),
      })),
    })),
  }
}

describe('fetchSpikeHistory', () => {
  it('returns array of {day, spikeX} for a channel', async () => {
    createClient.mockReturnValueOnce(
      mockChain(
        orderResolved([
          { day: '2026-04-01', spike_x: 1.2 },
          { day: '2026-04-02', spike_x: 3.4 },
        ]),
      ),
    )
    const result = await fetchSpikeHistory('UCxyz')
    expect(result).toEqual([
      { day: '2026-04-01', spikeX: 1.2 },
      { day: '2026-04-02', spikeX: 3.4 },
    ])
  })

  it('returns [] on supabase error', async () => {
    createClient.mockReturnValueOnce(
      mockChain(orderResolved(null, { message: 'oops' })),
    )
    expect(await fetchSpikeHistory('UCxyz')).toEqual([])
  })

  it('returns [] when data is null without error', async () => {
    createClient.mockReturnValueOnce(mockChain(orderResolved(null)))
    expect(await fetchSpikeHistory('UCxyz')).toEqual([])
  })
})
