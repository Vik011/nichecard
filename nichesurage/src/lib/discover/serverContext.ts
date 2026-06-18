// PR-C.2 — server-only trust helpers for the Discover endpoints.
//
// Tier and today's daily pin are resolved SERVER-SIDE from the authenticated
// session and the database — never trusted from client params. These run with
// the request's session server client (RLS-respecting) in PR-C.2; PR-C.3 will
// swap the data-read client to service-role alongside the authenticated SELECT
// revoke.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserTier } from '@/lib/types'
import { utcDateKey } from '@/lib/tier/freeDemo'

export interface SessionUser {
  /** null when there is no authenticated session — caller must return 401. */
  userId: string | null
  /** Server-derived tier (defaults to 'free'); never read from client input. */
  tier: UserTier
}

/**
 * Resolve the caller from the session and their tier from public.users.
 * Mirrors UserContext: select `tier` for the authenticated user, default
 * 'free'. Returns userId=null when unauthenticated (caller fails closed 401).
 */
export async function resolveSessionUser(
  supabase: SupabaseClient,
): Promise<SessionUser> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { userId: null, tier: 'free' }

  const { data } = await supabase
    .from('users')
    .select('tier')
    .eq('id', user.id)
    .single()

  const tier = (data?.tier as UserTier | undefined) ?? 'free'
  return { userId: user.id, tier }
}

/**
 * Read-only resolution of today's global daily pin (scan_results.id) from
 * daily_demo_niche keyed by the current UTC date. Does NOT pick/write — the
 * pin selection/writer (getDailyDemoNiche, /api/demo/today, auth callback) is
 * unchanged and remains the sole owner of picking. Returns null when no pin
 * exists yet today → Free redacts everything (fail-safe).
 */
export async function resolveTodayPinId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data } = await supabase
    .from('daily_demo_niche')
    .select('scan_result_id')
    .eq('date', utcDateKey(new Date()))
    .maybeSingle()

  return (data?.scan_result_id as string | undefined) ?? null
}
