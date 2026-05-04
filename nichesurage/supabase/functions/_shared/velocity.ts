// supabase/functions/_shared/velocity.ts
//
// Sprint B Phase 3: pure-function module deriving per-video velocity,
// acceleration, breakout ratio, and lifecycle classification from a
// snapshot history. NO I/O. NO database calls. NO network.
//
// Inputs: ordered list of VideoSnapshot rows for ONE video (ASC by
// scannedAt), the channel's subscriber count, and the video's
// publishedAt ISO string.
//
// Output: VelocityFeatures + a separate LifecycleStatus helper that
// classifies the growth phase from age + velocity_delta + cluster
// membership.

import type { VideoSnapshot, LifecycleStatus } from './types.ts'

export interface VelocityFeatures {
  viewsPerHour: number
  commentsPerHour: number
  likesPerHour: number
  velocityDelta: number      // ratio: latest_segment_velocity / prior_segment_velocity (>=0; 1 = no change)
  viewAcceleration: number   // (delta_T2 - delta_T1) per hour^2; positive = explosion, negative = cooling
  breakoutRatio: number      // latest_views / max(channel_subs, 100)
  hoursSinceUpload: number
}

const MIN_HOURS = 0.1
const MIN_SUBS_DENOM = 100

function hoursBetween(laterIso: string, earlierIso: string): number {
  const a = new Date(laterIso).getTime()
  const b = new Date(earlierIso).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return MIN_HOURS
  const hrs = (a - b) / 3_600_000
  return hrs < MIN_HOURS ? MIN_HOURS : hrs
}

function safeDivide(numer: number, denom: number, fallback: number): number {
  if (!Number.isFinite(numer) || !Number.isFinite(denom)) return fallback
  if (denom === 0) return fallback
  const r = numer / denom
  if (!Number.isFinite(r)) return fallback
  return r
}

function clampNonNeg(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

/**
 * Derive velocity features from one video's snapshot history.
 *
 * @param snapshots Ordered ASC by scannedAt. ≥1 row required.
 *                  CALLER PRECONDITION: must be sorted ascending by
 *                  scannedAt. Out-of-order input → undefined behavior
 *                  (the function still produces a finite result but the
 *                  segment definitions become meaningless).
 * @param channelSubs The channel's subscriber count at scan time.
 * @param publishedAt The video's publishedAt ISO string.
 *
 * Behavior by snapshot count:
 *   1 snapshot:  viewsPerHour = views / max(hoursSinceUpload, 0.1).
 *                velocityDelta = 1.0 (neutral, no comparison possible).
 *                viewAcceleration = 0.
 *   2 snapshots: velocityDelta = (latest_segment_vph) / (prior_segment_vph).
 *                The "prior" segment is publishedAt → snapshots[0].
 *                The "latest" segment is snapshots[0] → snapshots[1].
 *                viewAcceleration = 0 (need 3 points for second derivative).
 *   3+ snapshots: use the LAST THREE only.
 *                Three segments: T0→T1 velocity v1, T1→T2 velocity v2.
 *                velocityDelta = v2 / v1.
 *                viewAcceleration = (v2 - v1) / hours_between_segments.
 *                (positive value = views accelerating, negative = cooling)
 *
 * Defensive:
 *   - Division by zero → returns 0 (or 1.0 for velocityDelta — never NaN/Infinity).
 *   - Negative views (impossible but defensive) → 0.
 *   - hoursSinceUpload from publishedAt → latest scannedAt; never < 0.1.
 *   - Future-dated publishedAt → hoursSinceUpload clamped to 0.1.
 *   - Invalid publishedAt (empty / unparseable) → hoursSinceUpload = 1 (neutral).
 *   - channelSubs ≤ 0 → uses 100 in breakoutRatio denominator.
 *   - Empty snapshots array → throws Error('snapshots required').
 */
export function computeVelocityFeatures(
  snapshots: VideoSnapshot[],
  channelSubs: number,
  publishedAt: string,
): VelocityFeatures {
  if (!snapshots || snapshots.length === 0) {
    throw new Error('snapshots required')
  }

  const latest = snapshots[snapshots.length - 1]
  const latestViews = clampNonNeg(latest.viewCount)
  const latestComments = clampNonNeg(latest.commentCount)
  const latestLikes = clampNonNeg(latest.likeCount)

  // hoursSinceUpload: from publishedAt → latest scan.
  // Defensive: invalid publishedAt → 1.0 (neutral). Future date or
  // anything < 0.1h → clamp to 0.1.
  const publishedMs = new Date(publishedAt).getTime()
  const latestMs = new Date(latest.scannedAt).getTime()
  let hoursSinceUpload: number
  if (!Number.isFinite(publishedMs) || !Number.isFinite(latestMs)) {
    hoursSinceUpload = 1
  } else {
    const raw = (latestMs - publishedMs) / 3_600_000
    hoursSinceUpload = raw < MIN_HOURS ? MIN_HOURS : raw
  }

  // Per-hour rates always derived from latest cumulative counts and the
  // total age — gives a stable "average since upload" rate that is robust
  // to snapshot count.
  const viewsPerHour = safeDivide(latestViews, hoursSinceUpload, 0)
  const commentsPerHour = safeDivide(latestComments, hoursSinceUpload, 0)
  const likesPerHour = safeDivide(latestLikes, hoursSinceUpload, 0)

  const denomSubs = channelSubs > 0 ? channelSubs : MIN_SUBS_DENOM
  const breakoutRatio = safeDivide(
    latestViews,
    Math.max(denomSubs, MIN_SUBS_DENOM),
    0,
  )

  let velocityDelta = 1.0
  let viewAcceleration = 0

  if (snapshots.length === 2) {
    // Prior segment: publishedAt → snapshots[0]
    // Latest segment: snapshots[0] → snapshots[1]
    const s0 = snapshots[0]
    const s1 = snapshots[1]
    const v0 = clampNonNeg(s0.viewCount)
    const v1 = clampNonNeg(s1.viewCount)

    const priorHrs = hoursBetween(s0.scannedAt, publishedAt)
    const latestHrs = hoursBetween(s1.scannedAt, s0.scannedAt)

    const priorVph = safeDivide(v0, priorHrs, 0)
    const latestVph = safeDivide(v1 - v0, latestHrs, 0)

    velocityDelta = priorVph > 0 ? safeDivide(latestVph, priorVph, 1.0) : 1.0
    if (!Number.isFinite(velocityDelta) || velocityDelta < 0) velocityDelta = 1.0
    viewAcceleration = 0
  } else if (snapshots.length >= 3) {
    // Use the LAST THREE only.
    const t0 = snapshots[snapshots.length - 3]
    const t1 = snapshots[snapshots.length - 2]
    const t2 = snapshots[snapshots.length - 1]
    const v0 = clampNonNeg(t0.viewCount)
    const v1 = clampNonNeg(t1.viewCount)
    const v2 = clampNonNeg(t2.viewCount)

    const seg1Hrs = hoursBetween(t1.scannedAt, t0.scannedAt)
    const seg2Hrs = hoursBetween(t2.scannedAt, t1.scannedAt)

    const vel1 = safeDivide(v1 - v0, seg1Hrs, 0)
    const vel2 = safeDivide(v2 - v1, seg2Hrs, 0)

    velocityDelta = vel1 > 0 ? safeDivide(vel2, vel1, 1.0) : 1.0
    if (!Number.isFinite(velocityDelta) || velocityDelta < 0) velocityDelta = 1.0

    // Acceleration: Δvelocity / Δt where Δt is the gap between the two
    // segment midpoints — approximated here as seg2Hrs (the more recent
    // window). Sign matters more than magnitude for downstream rules.
    viewAcceleration = safeDivide(vel2 - vel1, seg2Hrs, 0)
    if (!Number.isFinite(viewAcceleration)) viewAcceleration = 0
  }

  return {
    viewsPerHour,
    commentsPerHour,
    likesPerHour,
    velocityDelta,
    viewAcceleration,
    breakoutRatio,
    hoursSinceUpload,
  }
}

/**
 * Classify the lifecycle phase of a video's growth curve.
 *
 * Pure function — depends only on age + velocity ratio + cluster membership.
 * Cluster size comes from `trend_cluster_members` count in Phase 5+;
 * pass 0 in Phase 3 (no clusters exist yet — `saturated` is unreachable
 * but reachable later).
 *
 * Rules (in order, first match wins):
 *   - age < 24h  AND velocityDelta > 1.5            → 'emerging'
 *   - age < 72h  AND velocityDelta > 1.5            → 'exploding'
 *   - age < 168h AND 0.8 ≤ velocityDelta ≤ 1.2      → 'peak'
 *   - clusterSize > 20 AND velocityDelta < 0.8      → 'saturated'
 *   - velocityDelta < 0.5                            → 'dying'
 *   - default                                        → 'peak'
 */
export function deriveLifecycleStatus(
  ageHours: number,
  velocityDelta: number,
  clusterSize: number,
): LifecycleStatus {
  if (ageHours < 24 && velocityDelta > 1.5) return 'emerging'
  if (ageHours < 72 && velocityDelta > 1.5) return 'exploding'
  if (ageHours < 168 && velocityDelta >= 0.8 && velocityDelta <= 1.2) return 'peak'
  if (clusterSize > 20 && velocityDelta < 0.8) return 'saturated'
  if (velocityDelta < 0.5) return 'dying'
  return 'peak'
}
