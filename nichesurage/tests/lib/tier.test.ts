// tests/lib/tier.test.ts
import { canViewChannelDetails, canUseAIFeatures, getSubscriberRange } from '@/lib/tier'

describe('canViewChannelDetails', () => {
  it('returns false for free tier', () => {
    expect(canViewChannelDetails('free')).toBe(false)
  })
  it('returns true for basic tier', () => {
    expect(canViewChannelDetails('basic')).toBe(true)
  })
  it('returns true for premium tier', () => {
    expect(canViewChannelDetails('premium')).toBe(true)
  })
})

describe('canUseAIFeatures', () => {
  it('returns false for free tier', () => {
    expect(canUseAIFeatures('free')).toBe(false)
  })
  it('returns false for basic tier', () => {
    expect(canUseAIFeatures('basic')).toBe(false)
  })
  it('returns true for premium tier', () => {
    expect(canUseAIFeatures('premium')).toBe(true)
  })
})

describe('getSubscriberRange', () => {
  it('returns range string for free tier', () => {
    expect(getSubscriberRange('free', 2100)).toBe('1k–5k range')
  })
  it('returns exact count for basic tier', () => {
    expect(getSubscriberRange('basic', 2100)).toBe('2,100')
  })
  it('returns 0–1k for subscriber count under 1000', () => {
    expect(getSubscriberRange('free', 890)).toBe('0–1k range')
  })
  it('returns 5k–10k range for count 5000–9999', () => {
    expect(getSubscriberRange('free', 7500)).toBe('5k–10k range')
  })
})
