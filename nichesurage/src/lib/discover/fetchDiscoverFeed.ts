import { createClient } from '@/lib/supabase/client'
import { mapRow } from '@/lib/supabase/queries'
import type { DbScanResult } from '@/lib/types/database'
import type { NicheCardData } from '@/lib/types'

export type DiscoverFeedMode = 'hot' | 'all'

export interface FetchDiscoverFeedOptions {
  mode: DiscoverFeedMode
  /** Soft cap on rows returned. Defaults to 60 (matches the unified grid's
   *  paginated step). Use higher for "Show more" expansions. */
  limit?: number
}

const DEFAULT_LIMIT = 60
const HOT_WINDOW_DAYS = 14

type ScanResultWithCluster = DbScanResult & {
  niche_clusters?: { id: string; label: string } | null
}

/**
 * Unified discover feed fetcher.
 *
 * Replaces fetchHotNiches + fetchQualityNiches + fetchTrendingClusters
 * for the simplified one-page Discover surface. No content_type / spike /
 * outlier-floor / subscriber / age / cluster filtering — the value of
 * those filters did not justify the combinatorial bug surface they
 * created.
 *
 * Modes:
 *   - 'hot':  channels added to channels_watchlist within the last
 *             HOT_WINDOW_DAYS (default 14d), sorted by tier_entered_at
 *             desc then outlier_ratio desc. Surfaces fresh discoveries
 *             immediately, before they accumulate spike history.
 *
 *   - 'all':  every row in scan_results_latest, sorted purely by
 *             outlier_ratio desc. Established spike-leaders dominate
 *             this list — the "proven performers" surface.
 *
 * Hot mode requires a join from scan_results_latest to channels_watchlist
 * for tier_entered_at. We do this with two queries (cheaper than the
 * embed PostgREST builds, and we control ordering precisely):
 *   1. Get channels_watchlist rows where tier_entered_at >= cutoff,
 *      ordered by tier_entered_at desc, take youtube_channel_ids
 *   2. Pull scan_results_latest rows for those channel_ids
 *   3. Re-sort the final list by tier_entered_at preserved from step 1
 */
export async function fetchDiscoverFeed(
  opts: FetchDiscoverFeedOptions,
): Promise<{ data: NicheCardData[]; error: string | null }> {
  const limit = opts.limit ?? DEFAULT_LIMIT
  const supabase = createClient()

  if (opts.mode === 'hot') {
    return fetchHotMode(supabase, limit)
  }
  return fetchAllMode(supabase, limit)
}

async function fetchHotMode(
  supabase: ReturnType<typeof createClient>,
  limit: number,
): Promise<{ data: NicheCardData[]; error: string | null }> {
  const cutoffIso = new Date(
    Date.now() - HOT_WINDOW_DAYS * 86400 * 1000,
  ).toISOString()

  // Step 1: recent channels by tier_entered_at, capped 2x limit so we
  // have headroom in case some channels have no scan_results yet.
  const { data: watchRows, error: watchErr } = await supabase
    .from('channels_watchlist')
    .select('youtube_channel_id, tier_entered_at')
    .gte('tier_entered_at', cutoffIso)
    .eq('is_active', true)
    .is('evicted_at', null)
    .order('tier_entered_at', { ascending: false, nullsFirst: false })
    .limit(limit * 2)

  if (watchErr) return { data: [], error: 'Discover fetch failed' }
  const watch = (watchRows ?? []) as Array<{
    youtube_channel_id: string
    tier_entered_at: string
  }>
  if (watch.length === 0) return { data: [], error: null }

  const channelIds = watch.map((w) => w.youtube_channel_id)
  const enteredAtById = new Map<string, string>()
  for (const w of watch) {
    enteredAtById.set(w.youtube_channel_id, w.tier_entered_at)
  }

  // Step 2: scan_results_latest for those channels
  const { data: scanRows, error: scanErr } = await supabase
    .from('scan_results_latest')
    .select('*, niche_clusters(id, label)')
    .in('youtube_channel_id', channelIds)
    .limit(limit * 2)

  if (scanErr) return { data: [], error: 'Discover fetch failed' }
  const scan = (scanRows ?? []) as ScanResultWithCluster[]

  // Step 3: re-sort by opportunity_score desc (primary), tier_entered_at
  // desc (secondary tiebreaker). Score is the big number on the card so
  // users expect "Hot Now" to surface highest-score recent discoveries
  // first. Recency only matters as a tiebreaker between channels with
  // identical scores.
  scan.sort((a, b) => {
    const sa = a.opportunity_score ?? 0
    const sb = b.opportunity_score ?? 0
    if (sa !== sb) return sb - sa
    const ea = enteredAtById.get(a.youtube_channel_id) ?? ''
    const eb = enteredAtById.get(b.youtube_channel_id) ?? ''
    return eb.localeCompare(ea)
  })

  return {
    data: scan.slice(0, limit).map((row) => mapRow(row)),
    error: null,
  }
}

async function fetchAllMode(
  supabase: ReturnType<typeof createClient>,
  limit: number,
): Promise<{ data: NicheCardData[]; error: string | null }> {
  // Sort by opportunity_score desc to match the visible big number on the
  // card. Users expect "Best first" to mean the score they see, not the
  // raw outlier_ratio (which is a smaller-text supporting metric).
  const { data, error } = await supabase
    .from('scan_results_latest')
    .select('*, niche_clusters(id, label)')
    .order('opportunity_score', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) return { data: [], error: 'Discover fetch failed' }
  const rows = (data ?? []) as ScanResultWithCluster[]
  return {
    data: rows.map((row) => mapRow(row)),
    error: null,
  }
}
