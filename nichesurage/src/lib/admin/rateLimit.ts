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
