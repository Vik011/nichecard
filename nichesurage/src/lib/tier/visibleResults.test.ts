import { computeVisibleResults } from './visibleResults'

interface TestRow {
  id: string
}

function rows(ids: string[]): TestRow[] {
  return ids.map((id) => ({ id }))
}

describe('computeVisibleResults', () => {
  const now = new Date('2026-05-22T14:00:00Z')
  const userId = 'user-abc'

  describe('premium / basic', () => {
    const seven = rows(['a', 'b', 'c', 'd', 'e', 'f', 'g'])

    it('premium returns the first visibleCount rows', () => {
      const out = computeVisibleResults({
        tier: 'premium',
        userId,
        results: seven,
        visibleCount: 3,
        now,
        todayPinId: null,
      })
      expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    })

    it('basic returns the first visibleCount rows', () => {
      const out = computeVisibleResults({
        tier: 'basic',
        userId,
        results: seven,
        visibleCount: 5,
        now,
        todayPinId: null,
      })
      expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
    })
  })

  describe('free', () => {
    const seven = rows(['top0', 'top1', 'top2', 'top3', 'pin', 'extra1', 'extra2'])

    it('returns top 4 + pin when pin is at position ≥4', () => {
      const out = computeVisibleResults({
        tier: 'free',
        userId,
        results: seven,
        visibleCount: 12,
        now,
        todayPinId: 'pin',
      })
      expect(out.map((r) => r.id)).toEqual(['top0', 'top1', 'top2', 'top3', 'pin'])
    })

    it('returns just top 4 when pin is null', () => {
      const out = computeVisibleResults({
        tier: 'free',
        userId,
        results: seven,
        visibleCount: 12,
        now,
        todayPinId: null,
      })
      expect(out.map((r) => r.id)).toEqual(['top0', 'top1', 'top2', 'top3'])
    })

    it('returns just top 4 when pin id is not in results', () => {
      const out = computeVisibleResults({
        tier: 'free',
        userId,
        results: seven,
        visibleCount: 12,
        now,
        todayPinId: 'not-in-list',
      })
      expect(out.map((r) => r.id)).toEqual(['top0', 'top1', 'top2', 'top3'])
    })

    it('returns just top 4 when pin id is already inside the top 4 (no dup)', () => {
      const out = computeVisibleResults({
        tier: 'free',
        userId,
        results: seven,
        visibleCount: 12,
        now,
        todayPinId: 'top2',
      })
      expect(out.map((r) => r.id)).toEqual(['top0', 'top1', 'top2', 'top3'])
    })

    it('returns what we have when pool ≤ 4 even with a pin', () => {
      const three = rows(['a', 'b', 'c'])
      const out = computeVisibleResults({
        tier: 'free',
        userId,
        results: three,
        visibleCount: 12,
        now,
        todayPinId: 'b',
      })
      expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    })
  })
})
