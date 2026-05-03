import {
  hashStringToInt,
  getFreeWindowIndex,
  getFreeRevealedIndex,
  getRevealedIds,
  getNextRevealAt,
  getMsUntilNextReveal,
  FREE_WINDOW_MS,
  FREE_REVEAL_RANGE_START,
  FREE_REVEAL_RANGE_END,
  BASIC_VISIBLE_COUNT,
} from './reveal'

const SOME_DAY = new Date('2026-05-03T10:30:00.000Z') // mid 6h window

describe('hashStringToInt', () => {
  it('is deterministic', () => {
    expect(hashStringToInt('user-1:42')).toBe(hashStringToInt('user-1:42'))
  })

  it('differs across slightly different inputs', () => {
    expect(hashStringToInt('user-1:42')).not.toBe(hashStringToInt('user-1:43'))
    expect(hashStringToInt('user-1:42')).not.toBe(hashStringToInt('user-2:42'))
  })

  it('always returns a non-negative integer', () => {
    for (const s of ['', 'x', 'a longer string', 'unicode: αβγ', '!!!']) {
      const h = hashStringToInt(s)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(h)).toBe(true)
    }
  })
})

describe('getFreeWindowIndex', () => {
  it('is constant within a 6h window', () => {
    const a = new Date('2026-05-03T00:00:01.000Z')
    const b = new Date('2026-05-03T05:59:59.999Z')
    expect(getFreeWindowIndex(a)).toBe(getFreeWindowIndex(b))
  })

  it('advances at the 6h boundary', () => {
    const before = new Date('2026-05-03T05:59:59.999Z')
    const after = new Date('2026-05-03T06:00:00.001Z')
    expect(getFreeWindowIndex(after)).toBe(getFreeWindowIndex(before) + 1)
  })
})

describe('getFreeRevealedIndex', () => {
  it('returns null when the pool is too small to have a position 9', () => {
    expect(getFreeRevealedIndex('u', SOME_DAY, FREE_REVEAL_RANGE_START)).toBeNull()
    expect(getFreeRevealedIndex('u', SOME_DAY, 0)).toBeNull()
    expect(getFreeRevealedIndex('u', SOME_DAY, 5)).toBeNull()
  })

  it('returns an index in [9, 19] for a full-size pool', () => {
    for (const userId of ['u1', 'u2', 'u3', 'u4', 'u5', 'u6']) {
      const idx = getFreeRevealedIndex(userId, SOME_DAY, 30)
      expect(idx).not.toBeNull()
      expect(idx!).toBeGreaterThanOrEqual(FREE_REVEAL_RANGE_START)
      expect(idx!).toBeLessThanOrEqual(FREE_REVEAL_RANGE_END)
    }
  })

  it('clamps the upper bound when the pool is between 10 and 20 items', () => {
    // With pool size 12, eligible range is [9, 11] (3 slots). All picks must
    // land in that range regardless of user.
    for (let i = 0; i < 30; i++) {
      const idx = getFreeRevealedIndex(`u-${i}`, SOME_DAY, 12)
      expect(idx).not.toBeNull()
      expect(idx!).toBeGreaterThanOrEqual(9)
      expect(idx!).toBeLessThanOrEqual(11)
    }
  })

  it('returns the same index for the same user within the same window', () => {
    const t1 = new Date('2026-05-03T00:10:00.000Z')
    const t2 = new Date('2026-05-03T05:55:00.000Z') // still same 6h window
    expect(getFreeRevealedIndex('alice', t1, 30)).toBe(
      getFreeRevealedIndex('alice', t2, 30),
    )
  })

  it('rotates at the next 6h boundary (different users see fresh distributions too)', () => {
    const before = new Date('2026-05-03T05:30:00.000Z')
    const after = new Date('2026-05-03T06:30:00.000Z')

    // We don't assert that EVERY user changes (a hash collision is allowed),
    // only that the overall distribution shifts. Sample 50 users and check
    // that at least some of them get a different index after the boundary.
    let changed = 0
    for (let i = 0; i < 50; i++) {
      const a = getFreeRevealedIndex(`user-${i}`, before, 30)
      const b = getFreeRevealedIndex(`user-${i}`, after, 30)
      if (a !== b) changed++
    }
    expect(changed).toBeGreaterThan(30) // expect ~90% to change in practice
  })

  it('distributes across the full eligible range, not just one slot', () => {
    // 200 random user ids → we should see meaningful variance across [9, 19].
    const seen = new Set<number>()
    for (let i = 0; i < 200; i++) {
      const idx = getFreeRevealedIndex(`u-${i}-extra-entropy`, SOME_DAY, 30)
      if (idx !== null) seen.add(idx)
    }
    // Expect at least 7 of the 11 possible slots to be hit. Hash quality
    // isn't perfect on tiny seeds; this is a generous lower bound.
    expect(seen.size).toBeGreaterThanOrEqual(7)
  })
})

describe('getRevealedIds', () => {
  const ids = Array.from({ length: 30 }, (_, i) => `niche-${i}`)

  it('reveals all ids for premium', () => {
    const set = getRevealedIds('premium', ids, 'u', SOME_DAY)
    expect(set.size).toBe(30)
  })

  it('reveals top 10 ids for basic, in input order', () => {
    const set = getRevealedIds('basic', ids, 'u', SOME_DAY)
    expect(set.size).toBe(BASIC_VISIBLE_COUNT)
    for (let i = 0; i < BASIC_VISIBLE_COUNT; i++) {
      expect(set.has(`niche-${i}`)).toBe(true)
    }
    expect(set.has(`niche-${BASIC_VISIBLE_COUNT}`)).toBe(false)
  })

  it('reveals exactly one id for free, picked from positions 9..19', () => {
    const set = getRevealedIds('free', ids, 'u', SOME_DAY)
    expect(set.size).toBe(1)
    const onlyId = Array.from(set)[0]
    const pos = ids.indexOf(onlyId)
    expect(pos).toBeGreaterThanOrEqual(FREE_REVEAL_RANGE_START)
    expect(pos).toBeLessThanOrEqual(FREE_REVEAL_RANGE_END)
  })

  it('returns an empty set for free when pool is too small', () => {
    const small = ids.slice(0, 5)
    expect(getRevealedIds('free', small, 'u', SOME_DAY).size).toBe(0)
  })

  it('reveals all available for basic when pool is smaller than top 10', () => {
    const small = ids.slice(0, 4)
    const set = getRevealedIds('basic', small, 'u', SOME_DAY)
    expect(set.size).toBe(4)
  })
})

describe('getNextRevealAt', () => {
  it('returns null for non-free tiers', () => {
    expect(getNextRevealAt('basic', SOME_DAY)).toBeNull()
    expect(getNextRevealAt('premium', SOME_DAY)).toBeNull()
  })

  it('returns a 6h-aligned timestamp in the future for free', () => {
    const at = getNextRevealAt('free', SOME_DAY)
    expect(at).not.toBeNull()
    expect(at!.getTime() % FREE_WINDOW_MS).toBe(0)
    expect(at!.getTime()).toBeGreaterThan(SOME_DAY.getTime())
    // Must be within the next 6h
    expect(at!.getTime() - SOME_DAY.getTime()).toBeLessThanOrEqual(FREE_WINDOW_MS)
  })

  it('exactly matches the next window boundary (00:00, 06:00, 12:00, 18:00 UTC)', () => {
    const t = new Date('2026-05-03T13:42:11.000Z') // mid 12:00–18:00 window
    const at = getNextRevealAt('free', t)
    expect(at!.toISOString()).toBe('2026-05-03T18:00:00.000Z')
  })
})

describe('getMsUntilNextReveal', () => {
  it('returns null for non-free tiers', () => {
    expect(getMsUntilNextReveal('basic', SOME_DAY)).toBeNull()
    expect(getMsUntilNextReveal('premium', SOME_DAY)).toBeNull()
  })

  it('returns a positive value for free, < FREE_WINDOW_MS', () => {
    const ms = getMsUntilNextReveal('free', SOME_DAY)
    expect(ms).not.toBeNull()
    expect(ms!).toBeGreaterThan(0)
    expect(ms!).toBeLessThanOrEqual(FREE_WINDOW_MS)
  })
})
