import {
  BASIC_VISIBLE_COUNT,
  getNextRevealAt,
  getMsUntilNextReveal,
  getRevealedIds,
} from './reveal'

describe('getRevealedIds', () => {
  const niches = ['n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6']
  const userId = 'user-abc'
  const now = new Date('2026-05-22T14:00:00Z')

  it('premium returns the full set', () => {
    const out = getRevealedIds('premium', niches, userId, now, 'n3')
    expect(out).toEqual(new Set(niches))
  })

  it('basic returns the top BASIC_VISIBLE_COUNT regardless of pin', () => {
    const out = getRevealedIds('basic', niches, userId, now, 'n6')
    expect(out).toEqual(new Set(niches.slice(0, BASIC_VISIBLE_COUNT)))
    expect(out.size).toBe(BASIC_VISIBLE_COUNT)
  })

  it('free returns ONLY the pin when pin is provided', () => {
    const out = getRevealedIds('free', niches, userId, now, 'n3')
    expect(out).toEqual(new Set(['n3']))
  })

  it('free returns empty set when pin is null (no pin yet today)', () => {
    const out = getRevealedIds('free', niches, userId, now, null)
    expect(out).toEqual(new Set())
  })

  it('free returns empty set when pin id is not in the fetched results', () => {
    const out = getRevealedIds('free', niches, userId, now, 'not-in-list')
    expect(out).toEqual(new Set())
  })

  it('free for the same pin is identical across two different user IDs', () => {
    const a = getRevealedIds('free', niches, 'user-a', now, 'n3')
    const b = getRevealedIds('free', niches, 'user-b', now, 'n3')
    expect(a).toEqual(b)
  })

  it('free for the same pin is identical across two different surfaces / sorts', () => {
    const sortedA = ['n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6']
    const sortedB = ['n6', 'n4', 'n3', 'n1', 'n2', 'n0', 'n5']
    expect(getRevealedIds('free', sortedA, userId, now, 'n3')).toEqual(new Set(['n3']))
    expect(getRevealedIds('free', sortedB, userId, now, 'n3')).toEqual(new Set(['n3']))
  })
})

describe('getNextRevealAt', () => {
  it('returns next UTC midnight for free tier', () => {
    const now = new Date('2026-05-22T14:30:00Z')
    const at = getNextRevealAt('free', now)
    expect(at?.toISOString()).toBe('2026-05-23T00:00:00.000Z')
  })

  it('returns null for basic', () => {
    expect(getNextRevealAt('basic', new Date())).toBeNull()
  })

  it('returns null for premium', () => {
    expect(getNextRevealAt('premium', new Date())).toBeNull()
  })
})

describe('getMsUntilNextReveal', () => {
  it('returns positive ms for free', () => {
    const now = new Date('2026-05-22T23:30:00Z')
    const ms = getMsUntilNextReveal('free', now)
    expect(ms).not.toBeNull()
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThanOrEqual(30 * 60 * 1000)
  })

  it('returns null for basic / premium', () => {
    expect(getMsUntilNextReveal('basic', new Date())).toBeNull()
    expect(getMsUntilNextReveal('premium', new Date())).toBeNull()
  })
})
