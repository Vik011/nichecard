import type { SupabaseClient } from '@supabase/supabase-js'
import { getAllowedChannelIds } from '@/lib/discover/channelGate'

// Daily-deterministic free demo niche.
//
// On a user's very first authenticated callback, the app redirects them to
// a single fully-unlocked niche detail page (the "WOW first 30s"). Per
// product decision 2026-05-07, that niche must be IDENTICAL for every free
// user who signs up on the same UTC calendar day — no "spin up 20 Google
// accounts to get 20 different unlocked niches" exploit.
//
// We pin the day's pick in the `daily_demo_niche` table (migration 0034).
// First call of the day INSERTs; subsequent calls SELECT the same row.
//
// Race resilience: parallel inserts collide on the date PK; PostgreSQL
// rejects all but one with `23505`. We catch and re-read.
//
// Failure modes:
//   * Empty candidate pool (cold start) → returns null; caller falls back
//     to `/discover` so the user lands on something instead of a 404.
//   * Service-role outage → returns null; caller falls back as above.

export interface DailyDemoNiche {
  /** scan_results.id — used to construct the detail URL. */
  scanResultId: string
  /** youtube_channel_id of the picked niche. */
  youtubeChannelId: string
  /**
   * True when this call is the one that pinned today's niche. False when
   * a previous caller had already pinned it and we're just reading the
   * winning row. Used by the auth callback to decide whether to kick off
   * the AI pre-warm — only the first sign-in of the day pays that cost,
   * everyone after rides the cache.
   */
  justInserted: boolean
}

export interface GetDailyDemoNicheOptions {
  /** Override "now" for deterministic testing. Default: real time. */
  now?: Date
  /** How many top candidates to consider when picking a fresh row. */
  candidatePoolSize?: number
}

const PG_UNIQUE_VIOLATION = '23505'

/** UTC date as YYYY-MM-DD; used as the PK in `daily_demo_niche`. */
export function utcDateKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Returns the demo niche pinned for today (UTC), inserting it on first
 * call of the day. Returns null when no candidate niches exist or when
 * the DB write fails.
 *
 * Caller MUST pass a service-role client. RLS on `daily_demo_niche` allows
 * SELECT for anon/authenticated, but INSERT requires bypassing RLS.
 */
export async function getDailyDemoNiche(
  supabaseService: Pick<SupabaseClient, 'from'>,
  options: GetDailyDemoNicheOptions = {},
): Promise<DailyDemoNiche | null> {
  const now = options.now ?? new Date()
  const poolSize = options.candidatePoolSize ?? 20
  const dateKey = utcDateKey(now)

  // 1) Try to read today's pinned pick first. Hot path on every login
  //    after the first of the day.
  const existing = await readPinned(supabaseService, dateKey)
  if (existing) return { ...existing, justInserted: false }

  // 2) No pin yet today. Choose a candidate niche.
  const candidate = await pickCandidate(supabaseService, poolSize)
  if (!candidate) return null

  // `now` is intentionally not threaded into pickCandidate today — the pin
  // pattern means rotation happens via UTC date boundaries, not within a
  // day. Kept on the public signature so a future "rotate within
  // candidates by hour" tweak doesn't have to bump callers.
  void now

  // 3) Attempt to claim the date by INSERTing. Race-safe because the
  //    `date` PK rejects collisions; a parallel writer who lost the race
  //    will re-read and see the winner's pick on the retry below.
  const { error: insertError } = await supabaseService
    .from('daily_demo_niche')
    .insert({
      date: dateKey,
      scan_result_id: candidate.scanResultId,
      youtube_channel_id: candidate.youtubeChannelId,
    })

  if (insertError) {
    if (insertError.code === PG_UNIQUE_VIOLATION) {
      // Race lost: another writer claimed the day a microsecond earlier.
      // Re-read so we return the winner's pick.
      const winner = await readPinned(supabaseService, dateKey)
      return winner ? { ...winner, justInserted: false } : null
    }
    // Real DB error (RLS misconfig, table missing, etc.): swallow + null.
    return null
  }

  return { ...candidate, justInserted: true }
}

async function readPinned(
  supabase: Pick<SupabaseClient, 'from'>,
  dateKey: string,
): Promise<{ scanResultId: string; youtubeChannelId: string } | null> {
  const { data, error } = await supabase
    .from('daily_demo_niche')
    .select('scan_result_id, youtube_channel_id')
    .eq('date', dateKey)
    .maybeSingle()

  if (error || !data) return null
  return {
    scanResultId: String(data.scan_result_id),
    youtubeChannelId: String(data.youtube_channel_id),
  }
}

async function pickCandidate(
  supabase: Pick<SupabaseClient, 'from'>,
  poolSize: number,
): Promise<{ scanResultId: string; youtubeChannelId: string } | null> {
  // Faceless catalog gate: the daily free-demo niche is a new user's first
  // impression of the product, so it must be faceless+active+not-evicted. Drop
  // any non-faceless rows before picking.
  const allowedIds = await getAllowedChannelIds(supabase)
  if (allowedIds.length === 0) return null

  // Top candidates by opportunity_score within the spike pool with a
  // labelled cluster (so the demo niche has a meaningful headline). We
  // pick the top one rather than rotating across the pool because the
  // pin makes that choice global anyway.
  const { data, error } = await supabase
    .from('scan_results_latest')
    .select('id, youtube_channel_id, niche_clusters!inner(id, label)')
    .eq('is_spike', true)
    .in('youtube_channel_id', allowedIds)
    .order('opportunity_score', { ascending: false, nullsFirst: false })
    .limit(poolSize)

  if (error || !data || data.length === 0) return null

  // The candidate-pool size is exposed for tests; in production we always
  // want the single top niche, so index 0 is the answer. Future: pick
  // from positions [0, poolSize-1] using a day-derived hash if we want
  // some daily visual variation while staying global-deterministic. For
  // v1, top-1 keeps it simple and ensures the most impressive niche is
  // the demo.
  const row = data[0]
  if (!row || typeof row.id !== 'string' || typeof row.youtube_channel_id !== 'string') {
    return null
  }
  return {
    scanResultId: row.id,
    youtubeChannelId: row.youtube_channel_id,
  }
}
