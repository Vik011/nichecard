// PR-C.2 — server-side identity redaction for the Discover feed/detail.
//
// THIS IS THE SECURITY BOUNDARY. It runs server-side (in the /api/discover
// route handlers) BEFORE the JSON is serialized to the browser. The client-side
// blur (LockedField) is cosmetic defense-in-depth only — it is NOT what keeps
// identity off the wire. For a locked card, real channel/video identity must
// never reach the browser; this module is what guarantees that.
//
// Entitlement mirrors the existing reveal logic (src/lib/tier/reveal.ts):
//   Premium → all rows revealed (full identity)
//   Basic   → top BASIC_VISIBLE_COUNT by current order revealed
//   Free    → only the global daily pin revealed
// `getRevealedIds` is a pure function and is reused here unchanged so the
// server decision is byte-for-byte the same set the client computes.
//
// PR-C.2 does NOT close authenticated direct REST access (a logged-in user can
// still query the tables directly with their JWT) — that is PR-C.3's revoke.
// This only closes the in-app/browser JSON leak.

import type { NicheCardData, UserTier } from '@/lib/types'
import { getRevealedIds } from '@/lib/tier/reveal'
import { coarseLabel, hiddenChannelLabel, maskedCatalogId } from './coarse'

/**
 * Return a copy of `row` with all channel/video identity blanked, UNLESS the
 * row is revealed (then it is returned untouched). Safe metrics/scores/bands
 * are preserved so a locked card still renders a useful teaser.
 */
export function redactRow(row: NicheCardData, revealed: boolean): NicheCardData {
  if (revealed) return row
  const isCatalog = row.id.startsWith('wl:')
  const redacted = {
    ...row,
    // `id` for scan rows is an opaque UUID (safe). Catalog rows embed the real
    // youtube_channel_id in the id → mask it so it never reaches the browser.
    id: isCatalog ? maskedCatalogId(row.id) : row.id,
    youtubeChannelId: '',
    channelUrl: undefined,
    channelName: hiddenChannelLabel(row.id),
    nicheLabel: coarseLabel(row.contentType),
    // Exact subscriber count is a secondary fingerprint and the card only ever
    // renders `subscriberRange` (the band), so drop the precise value to 0 for
    // locked rows. `subscriberRange` is preserved from the spread above.
    subscriberCount: 0,
    clusterId: undefined,
    clusterLabel: undefined,
    seedKeyword: undefined,
    outlierVideoTitle: undefined,
    outlierVideoViews: undefined,
    momentumVideoId: undefined,
    channelCreatedAt: '',
  }
  // Spreading a discriminated-union member and overwriting only optional/string
  // fields preserves the `contentType` discriminant, so the shape stays valid.
  return redacted as NicheCardData
}

/**
 * Redact a whole feed for a tier. Computes the revealed set with the shared
 * pure `getRevealedIds` over the SAME order the feed produced (so Basic's
 * top-N and Free's pin match the client exactly), redacts every non-revealed
 * row, and returns the redacted rows plus the revealed id set (so the client
 * can drive blur without re-deriving the security decision).
 */
export function redactFeed(
  rows: NicheCardData[],
  opts: { tier: UserTier; todayPinId: string | null },
): { data: NicheCardData[]; revealedIds: string[] } {
  const revealed = getRevealedIds(
    opts.tier,
    rows.map((r) => r.id),
    '',
    new Date(),
    opts.todayPinId,
  )
  const data = rows.map((r) => redactRow(r, revealed.has(r.id)))
  return { data, revealedIds: Array.from(revealed) }
}
