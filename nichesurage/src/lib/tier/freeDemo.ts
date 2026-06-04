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
// Revalidation: the internal app is faceless-only and niche reads are
// faceless-gated (PR #112). On read-back we re-validate the stored pin against
// the same gate + scan_results_latest lookup the page uses; if it no longer
// resolves (channel evicted/demoted, or scan_result_id superseded by a newer
// scan) we re-pick a valid faceless candidate and REPLACE today's row. The
// replacement is persisted-and-confirmed before being returned (fail closed) —
// today's row may change, but only ever to another valid faceless pin; prior
// days' rows are untouched.
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
  if (existing) {
    // PR #112 made every internal niche read faceless-gated. A pin written by
    // the pre-#112 ungated picker — or whose channel has since been
    // evicted/demoted, or whose scan_result_id has been superseded by a newer
    // scan (scan_results_latest is DISTINCT ON channel, latest-wins) — no
    // longer resolves via fetchNicheById, which left FREE users with an
    // all-locked grid (the injected pin silently dropped out of the feed).
    // Validate the stored pin exactly the way the surface resolves it.
    if (await pinStillResolvable(supabaseService, existing.scanResultId)) {
      return { ...existing, justInserted: false }
    }
    // Stored pin is invalid. Re-pick a faceless candidate (pickCandidate is
    // already gated) and REPLACE today's row so every same-day caller — and
    // the auth-callback / detail-page legitimacy checks that read
    // daily_demo_niche back — converge on one valid pin.
    //
    // FAIL CLOSED: only return the replacement once we've CONFIRMED it
    // persisted. A non-persisted pick would desync the redirect/modal
    // legitimacy checks, so an unconfirmed write yields null (no pin today)
    // rather than a phantom one.
    const replacement = await pickCandidate(supabaseService, poolSize)
    if (!replacement) return null
    const persisted = await replacePin(supabaseService, dateKey, replacement)
    if (!persisted) return null
    return { ...replacement, justInserted: true }
  }

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

/**
 * True when `scanResultId` still resolves under the same faceless gate +
 * latest-view lookup the discover surface uses (see fetchNicheById). Mirrors
 * that query exactly so "valid here" implies "renders on the page": the row
 * must be the channel's current scan_results_latest entry AND the channel must
 * be faceless+active+not-evicted. Fail closed (false) on any gate/read error.
 */
async function pinStillResolvable(
  supabase: Pick<SupabaseClient, 'from'>,
  scanResultId: string,
): Promise<boolean> {
  const allowedIds = await getAllowedChannelIds(supabase)
  if (allowedIds.length === 0) return false
  const { data, error } = await supabase
    .from('scan_results_latest')
    .select('id')
    .eq('id', scanResultId)
    .in('youtube_channel_id', allowedIds)
    .maybeSingle()
  return !error && Boolean(data)
}

/**
 * Replaces today's pinned row with a freshly-picked valid candidate and
 * CONFIRMS the write landed. Uses update().eq('date').select().maybeSingle()
 * so a silently-rejected or no-op write (RLS, transient error, missing row) is
 * detectable: callers MUST treat an unconfirmed row as a failed replacement and
 * fail closed. Concurrent replacements converge — pickCandidate is
 * deterministic top-1 — so last-write-wins writes the same value (idempotent,
 * no thrash, no loop).
 */
async function replacePin(
  supabase: Pick<SupabaseClient, 'from'>,
  dateKey: string,
  candidate: { scanResultId: string; youtubeChannelId: string },
): Promise<boolean> {
  const { data, error } = await supabase
    .from('daily_demo_niche')
    .update({
      scan_result_id: candidate.scanResultId,
      youtube_channel_id: candidate.youtubeChannelId,
      picked_at: new Date().toISOString(),
    })
    .eq('date', dateKey)
    .select('scan_result_id')
    .maybeSingle()
  if (error || !data) return false
  return String(data.scan_result_id) === candidate.scanResultId
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
