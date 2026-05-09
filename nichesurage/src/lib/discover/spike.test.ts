import { describe, it, expect } from '@jest/globals'
import { isSpikingNow } from './spike'

describe('isSpikingNow', () => {
  describe('longform', () => {
    it('fires when outlier_ratio >= 3', () => {
      expect(isSpikingNow({
        contentType: 'longform',
        outlierRatio: 3.0,
        outlierVideoViews: 0,
        subscriberCount: 1000,
      })).toBe(true)
    })

    it('does not fire when outlier_ratio < 3', () => {
      expect(isSpikingNow({
        contentType: 'longform',
        outlierRatio: 2.99,
        outlierVideoViews: 0,
        subscriberCount: 1000,
      })).toBe(false)
    })

    it('fires for high-ratio established channels', () => {
      // 100K-sub channel with 500K-view video
      expect(isSpikingNow({
        contentType: 'longform',
        outlierRatio: 5.0,
        outlierVideoViews: 500_000,
        subscriberCount: 100_000,
      })).toBe(true)
    })
  })

  describe('shorts', () => {
    it('fires when outlier_video_views >= 30K', () => {
      expect(isSpikingNow({
        contentType: 'shorts',
        outlierRatio: 1.0,
        outlierVideoViews: 30_000,
        subscriberCount: 100_000,
      })).toBe(true)
    })

    it('does not fire when outlier_video_views < 30K', () => {
      expect(isSpikingNow({
        contentType: 'shorts',
        outlierRatio: 100.0,
        outlierVideoViews: 29_999,
        subscriberCount: 50,
      })).toBe(false)
      // ^ note: high ratio (100×) but absolute views < 30K → not a spike.
      // Exactly the math-noise case the absolute floor solves.
    })

    it('fires for big short on small channel', () => {
      // 5K-sub shorts channel with 80K-view short
      expect(isSpikingNow({
        contentType: 'shorts',
        outlierRatio: 16.0,
        outlierVideoViews: 80_000,
        subscriberCount: 5_000,
      })).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('returns false on missing outlier data', () => {
      expect(isSpikingNow({
        contentType: 'longform',
        outlierRatio: undefined,
        outlierVideoViews: undefined,
        subscriberCount: undefined,
      })).toBe(false)
    })

    it('falls back to longform rule when contentType is undefined', () => {
      expect(isSpikingNow({
        contentType: undefined,
        outlierRatio: 5.0,
        outlierVideoViews: 1000,
        subscriberCount: 200,
      })).toBe(true)
    })
  })
})
