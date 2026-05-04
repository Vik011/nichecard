// supabase/functions/_shared/expectedPerformance.ts
//
// Sprint B Phase 6 (per A5 amendment): statistical expected-views model
// that lets trend_score reward small-channel outperformance without
// over-rewarding tiny channels (which the raw views/subs ratio did).
//
// Pure functions. No I/O. No DB.
//
// Replaces `breakoutRatio` in trendScore.
//
// Formula intent:
//   expected = niche_median_vps * subs * subAdjustment * (hours / 24)
//   ratio    = actual_views / expected
//
// `subAdjustment = log10(max(subs/100, 1) + 1)` softens the curve so that
// a 10M-sub channel doesn't get an unfairly low expectation. Result is
// scaled so a "matching the niche" video ends near ratio=1.0.

/**
 * Statistical expected views for a video given the channel's subscriber
 * count, the niche's median views-per-subscriber-per-day, and the time
 * since upload.
 *
 * Pure function. Defensive: clamps subs and hours to safe minimums.
 *
 * @param subs            Channel subscriber count. ≤0 → falls back to 100.
 * @param nicheMedianVps  Median views-per-subscriber-per-day for the niche.
 *                        Pass `nicheBaseline` from baseline.ts (already a
 *                        per-second/per-hour rate; here we re-document it
 *                        for the caller). Pass 0 for unknown → returns
 *                        a minimum of 1.
 * @param hoursSinceUpload Age in hours since publishedAt. <1 → clamped to 1.
 * @returns Expected views (always ≥1 to avoid div/0 downstream).
 */
export function expectedViews(
  subs: number,
  nicheMedianVps: number,
  hoursSinceUpload: number,
): number {
  const safeSubs = Number.isFinite(subs) && subs > 0 ? subs : 100
  const safeHours = Number.isFinite(hoursSinceUpload) && hoursSinceUpload >= 1
    ? hoursSinceUpload
    : 1
  const safeVps = Number.isFinite(nicheMedianVps) && nicheMedianVps > 0
    ? nicheMedianVps
    : 0
  const subAdjustment = Math.log10(Math.max(safeSubs / 100, 1) + 1)
  const result = safeVps * safeSubs * subAdjustment * (safeHours / 24)
  return Math.max(1, result)
}

/**
 * Ratio of actual views to expected views. >1 means outperforming niche
 * expectation, <1 means underperforming.
 *
 * Defensive: expected ≤0 → returns 0 (avoid div/0).
 */
export function performanceRatio(actualViews: number, expected: number): number {
  if (!Number.isFinite(actualViews) || !Number.isFinite(expected)) return 0
  if (expected <= 0) return 0
  if (actualViews <= 0) return 0
  return actualViews / expected
}
