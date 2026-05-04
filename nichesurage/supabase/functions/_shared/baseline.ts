// supabase/functions/_shared/baseline.ts
//
// Sprint B Phase 5A: baseline subtraction primitives + novelty score.
//
// The point: a high views_per_hour video on a high-baseline channel/niche
// is just normal performance, not "trending". Subtracting the niche baseline
// gives a "viral relative to peers" score that does NOT reward channels who
// always push big numbers.
//
// Two async helpers compute the median views_per_hour over a recent window
// (channel-scoped, niche-scoped). The pure helper computeNoveltyScore turns
// (currentVps, channelBaseline, nicheBaseline) into a single multiplier.
//
// SQL vs JS median note:
//   We fetch raw views_per_hour values via .select() and compute the median
//   in JS. Realistic per-channel sets are <100 rows in 30d; per-niche peak
//   is ~3k. Adding a percentile_cont RPC would require coordinating a new
//   migration on the live DB for negligible perf gain at current scale.
//   If/when category sets cross ~10k rows, port to a SQL aggregator.
//
// Caller responsibility (NOT enforced here):
//   - The 1.5× channel-baseline filter ("matches historical → not novel")
//     is enforced by the scan third pass, not by computeNoveltyScore.
//   - NULL category channels: skip novelty entirely; pass the result through
//     as null. computeNoveltyScore here works on numbers only.

import type { CategoryEnum } from './categories.ts'

// Minimal structural type — keeps this module untied from the supabase-js
// version and lets tests inject a tiny chainable mock.
// deno-lint-ignore no-explicit-any
type SupabaseLike = any

const DEFAULT_WINDOW_DAYS = 30

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/**
 * Median of an array of numbers. Filters out non-finite values defensively.
 * Empty (after filtering) → 0. Sort cost is O(n log n); fine at our scale.
 */
function median(values: unknown[]): number {
  const clean: number[] = []
  for (const v of values) {
    const n = typeof v === 'string' ? Number(v) : (v as number)
    if (isFiniteNumber(n)) clean.push(n)
  }
  if (clean.length === 0) return 0
  clean.sort((a, b) => a - b)
  const mid = clean.length >> 1
  if (clean.length % 2 === 1) return clean[mid]
  return (clean[mid - 1] + clean[mid]) / 2
}

function windowCutoffIso(days: number): string {
  const d = days > 0 && Number.isFinite(days) ? days : DEFAULT_WINDOW_DAYS
  return new Date(Date.now() - d * 24 * 3600 * 1000).toISOString()
}

/**
 * Median views_per_hour for ONE channel's videos in the trailing window.
 *
 * @param supabase  Service-role client.
 * @param channelId YouTube channel ID (channels_watchlist.youtube_channel_id,
 *                  which is what video_metrics.channel_id stores).
 * @param days      Window length. Defaults to 30 days. Non-positive / non-finite
 *                  values fall back to 30.
 * @returns         Median views_per_hour, or 0 if no data in window.
 */
export async function computeChannelBaseline(
  supabase: SupabaseLike,
  channelId: string,
  days: number = DEFAULT_WINDOW_DAYS,
): Promise<number> {
  const cutoff = windowCutoffIso(days)
  const { data, error } = await supabase
    .from('video_metrics')
    .select('views_per_hour')
    .eq('channel_id', channelId)
    .gte('computed_at', cutoff)
  if (error || !data) return 0
  const values = (data as Array<{ views_per_hour: unknown }>).map(r => r.views_per_hour)
  return median(values)
}

/**
 * Median views_per_hour across ALL channels in one category, in the window.
 *
 * Single query: video_metrics.category is denormalised onto each row at
 * upsert time (see scan/index.ts third pass), so we don't need a join to
 * channels_watchlist. Empty (no rows) → 0.
 */
export async function computeNicheBaseline(
  supabase: SupabaseLike,
  category: CategoryEnum,
  days: number = DEFAULT_WINDOW_DAYS,
): Promise<number> {
  const cutoff = windowCutoffIso(days)
  const { data, error } = await supabase
    .from('video_metrics')
    .select('views_per_hour')
    .eq('category', category)
    .gte('computed_at', cutoff)
  if (error || !data) return 0
  const values = (data as Array<{ views_per_hour: unknown }>).map(r => r.views_per_hour)
  return median(values)
}

/**
 * Pure helper. Returns how many "niche norms" the current video is above.
 *
 * Formula: (currentVps − nicheBaseline) / max(nicheBaseline, 1).
 *
 * - 0 means "exactly at niche norm" (no novelty)
 * - 2.0 means "3× the niche norm" (current = 3× baseline)
 * - Negative result clamped to 0 — a video below niche norm is not "novel".
 *
 * channelBaseline is intentionally ignored here. The caller decides whether
 * to suppress novelty when current < 1.5× channelBaseline ("matches the
 * channel's historical pace"); that filter sits in scan/index.ts so this
 * function stays trivially testable.
 */
export function computeNoveltyScore(
  currentVps: number,
  _channelBaseline: number,
  nicheBaseline: number,
): number {
  if (!isFiniteNumber(currentVps) || currentVps < 0) return 0
  const denom = isFiniteNumber(nicheBaseline) && nicheBaseline > 1 ? nicheBaseline : 1
  const niche = isFiniteNumber(nicheBaseline) ? nicheBaseline : 0
  const raw = (currentVps - niche) / denom
  if (!Number.isFinite(raw) || raw < 0) return 0
  return raw
}
