import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserTier } from '@/lib/types/database'

// Per-tier daily AI quota. The "deep-dive" is bundled — Health Check and
// Content Angles share the same counter, so a Basic user picks ONE niche
// per day to fully analyze. That's the upgrade trigger to Premium.
export const AI_DAILY_QUOTA: Record<UserTier, number> = {
  free: 0,
  basic: 1,
  premium: Infinity,
}

export type AiQuotaCheck =
  | { ok: true; tier: UserTier; usedToday: number; limit: number }
  | { ok: false; reason: 'tier'; tier: UserTier }
  | { ok: false; reason: 'limit'; tier: UserTier; usedToday: number; limit: number; resetAt: Date }

/** YYYY-MM-DD in UTC, matching the date column type used by ai_usage_daily. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Read-only check: is this user currently allowed to run an AI deep-dive?
 * Doesn't increment any counter — call recordAiRun() after the run succeeds
 * (or before, if you want a strict reservation; we use after-write to keep
 * cache hits free for the user when their quota would otherwise have been
 * spent on a no-op AI call).
 *
 * Actually — re-read this: even cache hits SHOULD count toward the quota,
 * because the user perceives the analysis as "their daily allowance used".
 * Treating cache hits as free would let a Basic user re-read the same
 * cached niche unlimited times, which is fine, but a fresh re-analysis on
 * a different niche after that would still cost. We deliberately keep that
 * generosity (cache reads = unlimited; new analyses = quota).
 */
export async function checkAiQuota(
  supabase: SupabaseClient,
  userId: string,
  tier: UserTier,
  now: Date = new Date(),
): Promise<AiQuotaCheck> {
  if (tier === 'free') {
    return { ok: false, reason: 'tier', tier }
  }
  const limit = AI_DAILY_QUOTA[tier]
  if (limit === Infinity) {
    return { ok: true, tier, usedToday: 0, limit }
  }

  const usedToday = await getAiRunsToday(supabase, userId, now)
  if (usedToday >= limit) {
    return {
      ok: false,
      reason: 'limit',
      tier,
      usedToday,
      limit,
      resetAt: tomorrowUtcMidnight(now),
    }
  }
  return { ok: true, tier, usedToday, limit }
}

/** Read the current day's count, defaulting to 0 if no row exists yet. */
export async function getAiRunsToday(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const day = todayUtc(now)
  const { data, error } = await supabase
    .from('ai_usage_daily')
    .select('count')
    .eq('user_id', userId)
    .eq('day', day)
    .maybeSingle()

  if (error) {
    // Don't pretend usage is zero on a transient DB error — that would let
    // unbounded retries through. Surface as "limit" to fail closed.
    console.error('[aiUsage] read error', error.message)
    return Number.POSITIVE_INFINITY
  }
  return (data?.count as number | undefined) ?? 0
}

/**
 * Atomically increment via RPC. Returns the new count. Idempotent under
 * retries only at the row level (PG UPSERT) — at the *quota* level, every
 * call increments. The API route should only invoke this once per request
 * after authorization passes.
 */
export async function recordAiRun(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const day = todayUtc(now)
  const { data, error } = await supabase.rpc('increment_ai_usage', {
    p_user_id: userId,
    p_day: day,
  })
  if (error) {
    // Throw — the caller (API route) should turn this into a 5xx; we
    // mustn't pretend the run was metered if the RPC failed, since the
    // user might then run again unmetered.
    throw new Error(`recordAiRun failed: ${error.message}`)
  }
  return (data as number | null) ?? 0
}

/** Next UTC midnight — when the daily counter resets. Used for resetAt UI. */
export function tomorrowUtcMidnight(now: Date): Date {
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  )
  return next
}
