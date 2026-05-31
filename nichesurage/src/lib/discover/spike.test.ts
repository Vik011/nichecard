import { describe, it, expect } from '@jest/globals'
import { isSpikingNow, isSpikingNowFromMomentum, MOMENTUM_TREND_FLOOR } from './spike'
import type { ChannelMomentum } from './spike'

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

describe('isSpikingNowFromMomentum', () => {
  const base: ChannelMomentum = {
    youtube_channel_id: 'UCtest',
    content_type: 'longform',
    best_video_id: 'vid1',
    best_video_age_hours: 100,
    last_metric_age_hours: 10,
    snapshot_count: 3,
    trend_score: MOMENTUM_TREND_FLOOR,
    lifecycle_status: 'exploding',
    velocity_delta: 1.5,
    views_per_hour: 200,
    current_eligible: true,
    last_snapshot_at: new Date().toISOString(),
  }

  it('returns true when current_eligible=true and trend_score >= floor', () => {
    expect(isSpikingNowFromMomentum({ ...base, trend_score: MOMENTUM_TREND_FLOOR + 5 })).toBe(true)
  })

  it('returns false when current_eligible=true but trend_score < floor', () => {
    expect(isSpikingNowFromMomentum({ ...base, trend_score: MOMENTUM_TREND_FLOOR - 1 })).toBe(false)
  })

  it('returns false when current_eligible=false regardless of trend_score', () => {
    expect(isSpikingNowFromMomentum({ ...base, current_eligible: false, trend_score: 100 })).toBe(false)
  })

  it('returns false when m is null', () => {
    expect(isSpikingNowFromMomentum(null)).toBe(false)
  })

  it('returns false when m is undefined', () => {
    expect(isSpikingNowFromMomentum(undefined)).toBe(false)
  })

  it('returns false when trend_score is null (null ?? 0 falls below floor)', () => {
    expect(isSpikingNowFromMomentum({ ...base, trend_score: null })).toBe(false)
  })

  it('returns true at exact floor boundary (>= not >)', () => {
    expect(isSpikingNowFromMomentum({ ...base, trend_score: MOMENTUM_TREND_FLOOR })).toBe(true)
  })
})
