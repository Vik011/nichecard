import { computeHealthScore } from './score'

describe('computeHealthScore', () => {
  it('returns max score for ideal niche', () => {
    const r = computeHealthScore({
      spike_multiplier: 12,
      opportunity_score: 95,
      engagement_rate: 0.18,
      virality_rating: 'excellent',
      subscriber_count: 4_500,
      views_48h: 250_000,
    })
    expect(r.score).toBeGreaterThanOrEqual(85)
    expect(r.score).toBeLessThanOrEqual(100)
  })

  it('returns low score for saturated niche', () => {
    const r = computeHealthScore({
      spike_multiplier: 1.1,
      opportunity_score: 22,
      engagement_rate: 0.02,
      virality_rating: 'average',
      subscriber_count: 800_000,
      views_48h: 90_000,
    })
    expect(r.score).toBeLessThanOrEqual(35)
  })

  it('exposes weighted components for transparency', () => {
    const r = computeHealthScore({
      spike_multiplier: 5,
      opportunity_score: 70,
      engagement_rate: 0.09,
      virality_rating: 'good',
      subscriber_count: 10_000,
      views_48h: 80_000,
    })
    expect(r.components).toEqual(expect.objectContaining({
      spike: expect.any(Number),
      opportunity: expect.any(Number),
      engagement: expect.any(Number),
      virality: expect.any(Number),
      saturation: expect.any(Number),
    }))
  })

  it('clamps inputs (no NaN, no above 100)', () => {
    const r = computeHealthScore({
      spike_multiplier: 999,
      opportunity_score: 200,
      engagement_rate: 5,
      virality_rating: 'excellent',
      subscriber_count: 0,
      views_48h: 0,
    })
    expect(r.score).toBeLessThanOrEqual(100)
    expect(Number.isFinite(r.score)).toBe(true)
  })

  it('handles all-null inputs gracefully', () => {
    const r = computeHealthScore({
      spike_multiplier: null,
      opportunity_score: null,
      engagement_rate: null,
      virality_rating: null,
      subscriber_count: null,
      views_48h: null,
    })
    expect(r.score).toBe(15)
    expect(Number.isFinite(r.score)).toBe(true)
  })

  it('rewards small channels with high saturation room', () => {
    const small = computeHealthScore({
      spike_multiplier: 5, opportunity_score: 60, engagement_rate: 0.08,
      virality_rating: 'good', subscriber_count: 500, views_48h: 50_000,
    })
    const big = computeHealthScore({
      spike_multiplier: 5, opportunity_score: 60, engagement_rate: 0.08,
      virality_rating: 'good', subscriber_count: 500_000, views_48h: 50_000,
    })
    expect(small.components.saturation).toBeGreaterThan(big.components.saturation)
    expect(small.score).toBeGreaterThan(big.score)
  })
})
