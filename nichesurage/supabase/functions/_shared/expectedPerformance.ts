// supabase/functions/_shared/expectedPerformance.ts
//
// Sprint B Phase 6 (per A5 amendment): heuristic expected-views model
// that replaces raw `breakoutRatio` in trendScore so small-channel
// outperformers aren't over-rewarded purely on views/subs.
//
// Pure functions. No I/O. No DB.
//
// Formula (per plan A5 spec, kept verbatim — the literal multiplication
// chain matters for spec compliance):
//   expected = nicheMedianRate * subs * subAdjustment * (hours / 24)
//   ratio    = actual_views / expected
//
// IMPORTANT — units honesty:
// The plan parameter is named `nicheMedianVps` and the original docstring
// described it as "views-per-subscriber-per-day". In practice the only
// upstream value we have is `computeNicheBaseline(...)` which returns
// median `views_per_hour` across the niche (a niche-wide per-video rate,
// NOT per-subscriber). Phase 6 wires that vph value straight into this
// parameter — the formula is therefore HEURISTIC, not statistically
// derived. The downstream trendScore clamps `log10(1+ratio)` to 2 so the
// signal is bounded regardless of the dimensional mismatch. Phase 9
// production tuning may revisit either (a) computing a real
// per-sub-per-day metric upstream, or (b) dropping the `* subs` term and
// treating this as a pure niche-vph multiplier.
//
// `subAdjustment = log10(max(subs/100, 1) + 1)` softens the curve so a
// 10M-sub channel doesn't get an unbounded expectation.

/**
 * Heuristic expected views for a video given the channel's subscriber
 * count, a niche-wide rate proxy, and time since upload.
 *
 * Pure function. Defensive: clamps subs and hours to safe minimums.
 *
 * @param subs              Channel subscriber count. ≤0 → falls back to 100.
 * @param nicheMedianVps    In Phase 6 callers pass `computeNicheBaseline()`,
 *                          which is median views-per-hour across the niche
 *                          (a niche-wide per-video rate, NOT per-subscriber-
 *                          per-day as the parameter name might suggest).
 *                          Plan-specified parameter name retained for spec
 *                          compliance. Pass 0 for unknown → floors to 1.
 * @param hoursSinceUpload  Age in hours since publishedAt. <1 → clamped to 1.
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
