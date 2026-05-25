/** @jest-environment jsdom */

import {
  getDailyModalSeenKey,
  hasSeenDailyModal,
  markDailyModalSeen,
  nextUtcMidnight,
} from './dailyModalCookie'

describe('dailyModalCookie', () => {
  describe('getDailyModalSeenKey', () => {
    it('returns the UTC date as YYYY-MM-DD', () => {
      const d = new Date(Date.UTC(2026, 4, 22, 14, 30, 0))
      expect(getDailyModalSeenKey(d)).toBe('2026-05-22')
    })

    it('rolls over at UTC midnight, not local midnight', () => {
      const beforeMidnight = new Date(Date.UTC(2026, 4, 22, 23, 59, 0))
      expect(getDailyModalSeenKey(beforeMidnight)).toBe('2026-05-22')

      const afterMidnight = new Date(Date.UTC(2026, 4, 23, 0, 0, 1))
      expect(getDailyModalSeenKey(afterMidnight)).toBe('2026-05-23')
    })
  })

  describe('nextUtcMidnight', () => {
    it('returns the next 00:00:00.000 UTC after `now`', () => {
      const now = new Date(Date.UTC(2026, 4, 22, 14, 30, 0))
      const next = nextUtcMidnight(now)
      expect(next.toISOString()).toBe('2026-05-23T00:00:00.000Z')
    })

    it('returns the next day at midnight even when `now` is exactly midnight', () => {
      const now = new Date(Date.UTC(2026, 4, 22, 0, 0, 0))
      const next = nextUtcMidnight(now)
      expect(next.toISOString()).toBe('2026-05-23T00:00:00.000Z')
    })
  })

  describe('hasSeenDailyModal', () => {
    it('returns true when cookie matches today', () => {
      const now = new Date(Date.UTC(2026, 4, 22, 12, 0, 0))
      expect(
        hasSeenDailyModal('other=1; sn_daily_modal_seen=2026-05-22; foo=bar', now),
      ).toBe(true)
    })

    it('returns false when cookie value is a previous day', () => {
      const now = new Date(Date.UTC(2026, 4, 22, 12, 0, 0))
      expect(
        hasSeenDailyModal('sn_daily_modal_seen=2026-05-21', now),
      ).toBe(false)
    })

    it('returns false when cookie missing', () => {
      const now = new Date(Date.UTC(2026, 4, 22, 12, 0, 0))
      expect(hasSeenDailyModal('other=1', now)).toBe(false)
      expect(hasSeenDailyModal('', now)).toBe(false)
    })
  })

  describe('markDailyModalSeen', () => {
    afterEach(() => {
      document.cookie = 'sn_daily_modal_seen=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
    })

    it('writes the today key to document.cookie', () => {
      // Use a future date so jsdom does not discard the cookie as already-expired.
      const now = new Date(Date.UTC(2099, 11, 30, 12, 0, 0))
      markDailyModalSeen(now)
      expect(document.cookie).toContain('sn_daily_modal_seen=2099-12-30')
    })
  })
})
