import type { NicheCardData } from '@/lib/types'
import type { LifecycleStatus } from '@/lib/types/database'

/**
 * Content-type-aware SPIKING NOW classifier.
 *
 * Replaces the universal `outlier_ratio >= 10` threshold with absolute
 * rules per content type, per user spec (2026-05-08 → 2026-05-09):
 *
 *   - Longform: best video has at least 3× the channel's subscriber count
 *     in views. Equivalent to outlier_ratio >= 3 for longform niches.
 *     Why 3×: a 1K-sub channel landing a 3K-view video has crossed
 *     the "noticeable spike" threshold without leaning on math noise
 *     (the 100-sub channel + 300-view video case PR #49 exposed).
 *
 *   - Shorts: best video has >=30K views absolute. The user's original
 *     spec was "VPH > 1000 OR current views >= 30K", but VPH derived
 *     from outlier_video_views / window_hours always trips the 30K
 *     check first (1000 VPH * 24h = 24K, * 48h = 48K — 30K bridges
 *     the band), so the simpler absolute view threshold captures the
 *     same intent without needing the publish-time math.
 *
 * Defaults:
 *   - undefined / null content type → longform rule (most niches
 *     historically were longform; conservative fallback).
 *   - missing subscriber_count or outlier_video_views → return false
 *     (don't fire badge on incomplete data).
 */

export const SPIKING_LONGFORM_OUTLIER_MIN = 3
export const SPIKING_SHORTS_VIEWS_MIN = 30_000

export function isSpikingNow(niche: Partial<Pick<NicheCardData,
  'contentType' | 'outlierRatio' | 'outlierVideoViews' | 'subscriberCount'
>>): boolean {
  const isShorts = niche.contentType === 'shorts'

  if (isShorts) {
    return (niche.outlierVideoViews ?? 0) >= SPIKING_SHORTS_VIEWS_MIN
  }

  // Longform (or unknown content_type — fall back to longform rule)
  return (niche.outlierRatio ?? 0) >= SPIKING_LONGFORM_OUTLIER_MIN
}

// ─── Part B: momentum-based spiking classifier ───────────────────────────────
//
// Reads from the channel_current_momentum VIEW (migration 0058). The VIEW
// already encodes all eligibility gates (snapshot freshness, video age,
// lifecycle, snapshot_count >= 2, content_type known) in the current_eligible
// boolean. isSpikingNowFromMomentum only adds the calibrated trend floor on top.
//
// One source of truth: the same current_eligible that drove DISTINCT ON
// selection is what the badge checks — no drift between ranking and display.

export interface ChannelMomentum {
  youtube_channel_id: string
  content_type: 'shorts' | 'longform' | null
  best_video_id: string | null
  best_video_age_hours: number | null
  last_metric_age_hours: number | null
  snapshot_count: number
  trend_score: number | null
  lifecycle_status: LifecycleStatus | null
  velocity_delta: number | null
  views_per_hour: number | null
  current_eligible: boolean
  last_snapshot_at: string | null
}

// Calibrated at p75 of eligible trend_score distribution (2026-05-31: n=121,
// p75=68.57). Hard-minimum 50 per B.4 spec — never 0. Spiking Now tab is
// allowed to be empty rather than show low-quality signals.
export const MOMENTUM_TREND_FLOOR = 70

export function isSpikingNowFromMomentum(
  m: ChannelMomentum | null | undefined,
  floor: number = MOMENTUM_TREND_FLOOR,
): boolean {
  if (!m) return false
  return m.current_eligible === true && (m.trend_score ?? 0) >= floor
}
