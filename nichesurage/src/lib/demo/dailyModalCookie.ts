// Daily-free-modal cookie helpers.
//
// The modal opens once per UTC day per device for returning FREE users.
// We use a 1st-party cookie (immune to Safari ITP since it never leaves
// the apex domain) and an `Expires=` set to next UTC midnight so a user
// in any TZ sees a fresh modal at the same instant we rotate the pin.

export const DAILY_MODAL_COOKIE_NAME = 'sn_daily_modal_seen'

/** UTC date as YYYY-MM-DD; the cookie value matches this format. */
export function getDailyModalSeenKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Next 00:00:00.000 UTC strictly AFTER `now`. When `now` is exactly
 * midnight we still return the next day so the cookie has positive
 * lifetime (a 0-MaxAge cookie would be immediately discarded).
 */
export function nextUtcMidnight(now: Date): Date {
  const d = new Date(now)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + 1)
  return d
}

/** Pure check against a cookie string. Caller passes `document.cookie`. */
export function hasSeenDailyModal(cookieString: string, now: Date): boolean {
  const key = getDailyModalSeenKey(now)
  const target = `${DAILY_MODAL_COOKIE_NAME}=${key}`
  return cookieString
    .split(';')
    .some((c) => c.trim() === target)
}

/** Side-effecting writer. Browser only; calling this in Node throws. */
export function markDailyModalSeen(now: Date): void {
  const expires = nextUtcMidnight(now).toUTCString()
  const value = getDailyModalSeenKey(now)
  document.cookie = `${DAILY_MODAL_COOKIE_NAME}=${value}; expires=${expires}; path=/; SameSite=Lax`
}
