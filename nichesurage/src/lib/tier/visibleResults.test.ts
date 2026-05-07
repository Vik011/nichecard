import { computeVisibleResults } from './visibleResults'
import { FREE_REVEAL_RANGE_START, FREE_REVEAL_RANGE_END, getFreeRevealedIndex } from './reveal'

const NOW = new Date('2026-05-07T10:00:00.000Z')

interface FakeNiche {
  id: string
}

function makeNiches(n: number): FakeNiche[] {
  return Array.from({ length: n }, (_, i) => ({ id: `niche-${i}` }))
}

describe('computeVisibleResults', () => {
  describe('free tier', () => {
    it('returns top 4 + the revealed card (5 total) for a normal-size pool', () => {
      const results = makeNiches(30)
      const out = computeVisibleResults({
        tier: 'free',
        userId: 'user-a',
        results,
        visibleCount: 12,
        now: NOW,
      })

      expect(out).toHaveLength(5)
      // Indices 0..3 must be the top 4 in input order.
      for (let i = 0; i < FREE_REVEAL_RANGE_START; i++) {
        expect(out[i].id).toBe(`niche-${i}`)
      }
      // Index 4 (5th card) must be the deterministic reveal pick.
      const revealIdx = getFreeRevealedIndex('user-a', NOW, results.length)
      expect(revealIdx).not.toBeNull()
      expect(out[FREE_REVEAL_RANGE_START].id).toBe(`niche-${revealIdx}`)
    })

    it('the 5th card is never the same as the top 4', () => {
      const results = makeNiches(30)
      // We only guarantee position-5 is in [4, 14], so the top-4 set and
      // the reveal slot are always disjoint. Spot-check across many users.
      for (let i = 0; i < 50; i++) {
        const out = computeVisibleResults({
          tier: 'free',
          userId: `user-${i}`,
          results,
          visibleCount: 12,
          now: NOW,
        })
        expect(out).toHaveLength(5)
        const revealedId = out[FREE_REVEAL_RANGE_START].id
        const topIds = out.slice(0, FREE_REVEAL_RANGE_START).map((n) => n.id)
        expect(topIds).not.toContain(revealedId)
      }
    })

    it("reveal position is stable for the same user within a 6h window (Fix B's contract)", () => {
      const results = makeNiches(30)
      const a = computeVisibleResults({
        tier: 'free',
        userId: 'stable-user',
        results,
        visibleCount: 12,
        now: new Date('2026-05-07T10:00:00.000Z'),
      })
      const b = computeVisibleResults({
        tier: 'free',
        userId: 'stable-user',
        results,
        visibleCount: 12,
        now: new Date('2026-05-07T11:30:00.000Z'), // same 6h window
      })
      expect(b[FREE_REVEAL_RANGE_START].id).toBe(a[FREE_REVEAL_RANGE_START].id)
    })

    it("position 5 lands in the reveal range [FREE_REVEAL_RANGE_START..END] of the original pool", () => {
      const results = makeNiches(30)
      const out = computeVisibleResults({
        tier: 'free',
        userId: 'rotation-user',
        results,
        visibleCount: 12,
        now: NOW,
      })
      const revealedId = out[FREE_REVEAL_RANGE_START].id
      const originalIdx = results.findIndex((n) => n.id === revealedId)
      expect(originalIdx).toBeGreaterThanOrEqual(FREE_REVEAL_RANGE_START)
      expect(originalIdx).toBeLessThanOrEqual(FREE_REVEAL_RANGE_END)
    })

    it('returns top 4 only (no reveal) when the pool size is exactly 4', () => {
      const results = makeNiches(4)
      const out = computeVisibleResults({
        tier: 'free',
        userId: 'user',
        results,
        visibleCount: 12,
        now: NOW,
      })
      expect(out).toHaveLength(4)
      expect(out.map((n) => n.id)).toEqual(['niche-0', 'niche-1', 'niche-2', 'niche-3'])
    })

    it('returns the entire pool when smaller than 4 (graceful degradation)', () => {
      const results = makeNiches(2)
      const out = computeVisibleResults({
        tier: 'free',
        userId: 'user',
        results,
        visibleCount: 12,
        now: NOW,
      })
      expect(out).toHaveLength(2)
    })

    it('clamps reveal upper bound when pool is between 5 and FREE_REVEAL_RANGE_END', () => {
      // Pool size 8 → reveal eligible range [4, 7]
      const results = makeNiches(8)
      for (let i = 0; i < 20; i++) {
        const out = computeVisibleResults({
          tier: 'free',
          userId: `user-${i}`,
          results,
          visibleCount: 12,
          now: NOW,
        })
        expect(out).toHaveLength(5)
        const revealedId = out[FREE_REVEAL_RANGE_START].id
        const idx = results.findIndex((n) => n.id === revealedId)
        expect(idx).toBeGreaterThanOrEqual(FREE_REVEAL_RANGE_START)
        expect(idx).toBeLessThanOrEqual(7)
      }
    })

    it('different users see different reveals (rotation surface)', () => {
      const results = makeNiches(30)
      const reveals = new Set<string>()
      for (let i = 0; i < 50; i++) {
        const out = computeVisibleResults({
          tier: 'free',
          userId: `user-${i}-extra-entropy`,
          results,
          visibleCount: 12,
          now: NOW,
        })
        reveals.add(out[FREE_REVEAL_RANGE_START].id)
      }
      // Hash quality: expect at least 7 of the 11 eligible slots to be hit.
      expect(reveals.size).toBeGreaterThanOrEqual(7)
    })

    it('ignores visibleCount for free (pinned at 5)', () => {
      const results = makeNiches(30)
      const a = computeVisibleResults({
        tier: 'free',
        userId: 'user',
        results,
        visibleCount: 5,
        now: NOW,
      })
      const b = computeVisibleResults({
        tier: 'free',
        userId: 'user',
        results,
        visibleCount: 24,
        now: NOW,
      })
      expect(a).toHaveLength(5)
      expect(b).toHaveLength(5)
      expect(a.map((n) => n.id)).toEqual(b.map((n) => n.id))
    })
  })

  describe('basic tier', () => {
    it('returns the legacy slice (visibleCount items)', () => {
      const results = makeNiches(30)
      const out = computeVisibleResults({
        tier: 'basic',
        userId: 'user',
        results,
        visibleCount: 12,
        now: NOW,
      })
      expect(out).toHaveLength(12)
      expect(out.map((n) => n.id)).toEqual(results.slice(0, 12).map((n) => n.id))
    })

    it('caps at the pool size when visibleCount exceeds it', () => {
      const results = makeNiches(8)
      const out = computeVisibleResults({
        tier: 'basic',
        userId: 'user',
        results,
        visibleCount: 24,
        now: NOW,
      })
      expect(out).toHaveLength(8)
    })
  })

  describe('premium tier', () => {
    it('returns the legacy slice (visibleCount items)', () => {
      const results = makeNiches(30)
      const out = computeVisibleResults({
        tier: 'premium',
        userId: 'user',
        results,
        visibleCount: 24,
        now: NOW,
      })
      expect(out).toHaveLength(24)
    })
  })
})
