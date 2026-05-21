/** @jest-environment node */
import { resolveUserTier } from './tierResolution'

const T0 = new Date('2026-05-21T12:00:00Z')
const PAST = '2026-05-20T12:00:00Z'
const FUTURE = '2026-05-22T12:00:00Z'

describe('resolveUserTier', () => {
  it('returns free when banned_at is set, regardless of tier', () => {
    expect(resolveUserTier({
      tier: 'premium', tier_source: 'stripe', tier_expires_at: null, banned_at: '2026-05-20T00:00:00Z',
    }, T0)).toBe('free')
  })

  it('returns the stored tier when tier_source is stripe', () => {
    expect(resolveUserTier({
      tier: 'basic', tier_source: 'stripe', tier_expires_at: null, banned_at: null,
    }, T0)).toBe('basic')
  })

  it('returns free when manual grant has expired', () => {
    expect(resolveUserTier({
      tier: 'premium', tier_source: 'manual', tier_expires_at: PAST, banned_at: null,
    }, T0)).toBe('free')
  })

  it('returns granted tier when manual grant is still fresh', () => {
    expect(resolveUserTier({
      tier: 'premium', tier_source: 'manual', tier_expires_at: FUTURE, banned_at: null,
    }, T0)).toBe('premium')
  })

  it('returns granted tier when manual grant has no expiry', () => {
    expect(resolveUserTier({
      tier: 'basic', tier_source: 'manual', tier_expires_at: null, banned_at: null,
    }, T0)).toBe('basic')
  })

  it('returns the stored tier when tier_source is null (legacy / free)', () => {
    expect(resolveUserTier({
      tier: 'free', tier_source: null, tier_expires_at: null, banned_at: null,
    }, T0)).toBe('free')
  })

  it('treats exact-equal expiry as expired', () => {
    expect(resolveUserTier({
      tier: 'premium', tier_source: 'manual', tier_expires_at: T0.toISOString(), banned_at: null,
    }, T0)).toBe('free')
  })
})
