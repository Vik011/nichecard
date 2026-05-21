/** @jest-environment node */

// Mock Upstash Redis BEFORE importing the module under test.
// We store references on a shared object so the factory closure and test
// bodies access the same jest.fn() instances regardless of hoisting order.
const mocks = {
  incr: jest.fn(),
  expire: jest.fn(),
}

jest.mock('@upstash/redis', () => ({
  Redis: class {
    static fromEnv() {
      return { incr: mocks.incr, expire: mocks.expire }
    }
  },
}))

import { incrementAndCheck, MAX_ACTIONS_PER_WINDOW, WINDOW_SECONDS } from './rateLimit'

beforeEach(() => {
  mocks.incr.mockReset()
  mocks.expire.mockReset()
  mocks.expire.mockResolvedValue(1)
})

describe('incrementAndCheck', () => {
  it('allows the first action and sets the TTL', async () => {
    mocks.incr.mockResolvedValueOnce(1)
    const r = await incrementAndCheck('admin@x.com')
    expect(r).toEqual({ allowed: true, count: 1 })
    expect(mocks.expire).toHaveBeenCalledTimes(1)
    expect(mocks.expire.mock.calls[0][1]).toBe(WINDOW_SECONDS)
  })

  it('allows actions up to the cap and does NOT re-set TTL after first', async () => {
    mocks.incr.mockResolvedValueOnce(2)
    const r = await incrementAndCheck('admin@x.com')
    expect(r).toEqual({ allowed: true, count: 2 })
    expect(mocks.expire).not.toHaveBeenCalled()
  })

  it('allows the boundary action exactly at the cap', async () => {
    mocks.incr.mockResolvedValueOnce(MAX_ACTIONS_PER_WINDOW)
    const r = await incrementAndCheck('admin@x.com')
    expect(r.allowed).toBe(true)
    expect(r.count).toBe(MAX_ACTIONS_PER_WINDOW)
  })

  it('blocks the action that exceeds the cap', async () => {
    mocks.incr.mockResolvedValueOnce(MAX_ACTIONS_PER_WINDOW + 1)
    const r = await incrementAndCheck('admin@x.com')
    expect(r.allowed).toBe(false)
    expect(r.count).toBe(MAX_ACTIONS_PER_WINDOW + 1)
  })

  it('lowercases the admin email in the Redis key', async () => {
    mocks.incr.mockResolvedValueOnce(1)
    await incrementAndCheck('Admin@X.COM')
    const key = mocks.incr.mock.calls[0][0]
    expect(key).toContain('admin@x.com')
    expect(key).not.toContain('Admin@X.COM')
  })

  it('uses fixed 5-min window buckets in the key', async () => {
    mocks.incr.mockResolvedValueOnce(1)
    await incrementAndCheck('admin@x.com')
    const key = mocks.incr.mock.calls[0][0]
    expect(key).toMatch(/^admin:rl:[^:]+:\d+$/)
  })
})
