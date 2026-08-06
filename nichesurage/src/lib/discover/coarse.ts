// PR-C.2 — coarse, non-identifying display helpers for redacted (locked)
// Discover cards. These intentionally mirror the logged-out landing teaser
// (src/lib/landing/fetchTopNiches.ts): a locked card shows only a content-type
// label and an opaque "Hidden Channel #" name, never real channel identity.
//
// Kept as a tiny standalone module (a one-line duplicate of the landing
// coarseLabel) so PR-C.2 does NOT touch the shipped PR-C.1 landing path.

import type { ContentType } from '@/lib/types'

/** Content-type-only label — never the real niche_label / cluster label. */
export function coarseLabel(contentType: ContentType): string {
  return contentType === 'shorts' ? 'Faceless Shorts' : 'Faceless Long-form'
}

// Deterministic 32-bit FNV-1a hash → unsigned int. Stable per input id, so a
// given card always renders the same Hidden Channel # within and across
// requests, while leaking no real identity.
function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Opaque display name for a locked card, seeded from the card's opaque id
 * (a scan_results UUID or a `wl:` catalog id). 3-digit label (100–999), the
 * same shape the landing RPC produces, but computed in TS.
 */
export function hiddenChannelLabel(id: string): string {
  return `Hidden Channel #${(hash32(id) % 900) + 100}`
}

/**
 * Catalog rows use `id = "wl:<youtube_channel_id>"`, so the id ITSELF carries
 * the real channel id. For a locked catalog row we must replace it with an
 * opaque token before serialization, or the youtube_channel_id leaks via `id`
 * even after every other field is redacted. The detail endpoint cannot resolve
 * this token (it isn't a real channel id) → free/basic get the redacted/upsell
 * path, which is the intended behavior for a locked card.
 */
export function maskedCatalogId(id: string): string {
  return `wl:hidden:${hash32(id).toString(36)}`
}
