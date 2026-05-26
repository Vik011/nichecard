import { Redis } from '@upstash/redis'

export const WINDOW_SECONDS = 300 // 5 minutes
export const MAX_ACTIONS_PER_WINDOW = 60

// Lazily initialised so tests can mock Redis.fromEnv() before the first call.
let _redis: ReturnType<typeof Redis.fromEnv> | null = null
function getRedis() {
  if (!_redis) _redis = Redis.fromEnv()
  return _redis
}

function windowBucket(now: number = Date.now()): number {
  return Math.floor(now / (WINDOW_SECONDS * 1000))
}

/**
 * Increment the rate-limit counter for `adminEmail` in the current 5-minute
 * window and return whether the action is allowed (count <= cap).
 *
 * Key shape: `admin:rl:{lower(email)}:{windowBucket}`. Each window is its
 * own key, so old windows expire naturally via the TTL set on first hit.
 * No cleanup cron required.
 */
export async function incrementAndCheck(adminEmail: string): Promise<{ allowed: boolean; count: number }> {
  const redis = getRedis()
  const key = `admin:rl:${adminEmail.toLowerCase()}:${windowBucket()}`
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, WINDOW_SECONDS)
  return { allowed: count <= MAX_ACTIONS_PER_WINDOW, count }
}

/**
 * Generic per-scope rate limiter. Use for any endpoint that needs a
 * "max N hits per window" cap keyed by something other than admin email
 * (e.g. user id on user-facing API routes).
 *
 * Key shape: `rl:{scope}:{identifier}:{windowBucket}`.
 */
export async function checkRateLimit(
  scope: string,
  identifier: string,
  cap: number,
  windowSeconds: number = WINDOW_SECONDS,
): Promise<{ allowed: boolean; count: number }> {
  const redis = getRedis()
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000))
  const key = `rl:${scope}:${identifier.toLowerCase()}:${bucket}`
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, windowSeconds)
  return { allowed: count <= cap, count }
}
