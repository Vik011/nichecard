import { formatViews, timeAgo } from './format'

describe('formatViews', () => {
  it('returns raw number under 1000', () => {
    expect(formatViews(0)).toBe('0')
    expect(formatViews(999)).toBe('999')
  })
  it('formats thousands as K', () => {
    expect(formatViews(1000)).toBe('1.0K')
    expect(formatViews(45_678)).toBe('45.7K')
  })
  it('formats millions as M', () => {
    expect(formatViews(1_000_000)).toBe('1.0M')
    expect(formatViews(2_345_678)).toBe('2.3M')
  })
})

describe('timeAgo', () => {
  const now = new Date('2026-05-02T12:00:00Z')

  it('handles seconds', () => {
    expect(timeAgo(new Date(now.getTime() - 30_000).toISOString(), now)).toBe('30s ago')
  })
  it('handles minutes', () => {
    expect(timeAgo(new Date(now.getTime() - 5 * 60_000).toISOString(), now)).toBe('5m ago')
  })
  it('handles hours', () => {
    expect(timeAgo(new Date(now.getTime() - 3 * 3_600_000).toISOString(), now)).toBe('3h ago')
  })
  it('handles days', () => {
    expect(timeAgo(new Date(now.getTime() - 4 * 86_400_000).toISOString(), now)).toBe('4d ago')
  })
  it('handles months', () => {
    expect(timeAgo(new Date(now.getTime() - 60 * 86_400_000).toISOString(), now)).toBe('2mo ago')
  })
  it('handles years', () => {
    expect(timeAgo(new Date(now.getTime() - 3 * 365 * 86_400_000).toISOString(), now)).toBe('3y ago')
  })
})
