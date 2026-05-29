import { createClient } from '@/lib/supabase/client'
import { mapRow } from '@/lib/supabase/queries'
import type { DbScanResult } from '@/lib/types/database'
import type { NicheCardData, UserTier } from '@/lib/types'
import { isSpikingNow } from './spike'

export type DiscoverFeedMode = 'hot' | 'all'
/**
 * Sprint Y (PR #58) — surface tabs aggregate three views over the same
 * scan_results pool:
 *   - 'all':         every visible niche, sorted by opportunity_score
 *   - 'spiking-now': filtered by isSpikingNow() (content-type-aware spike rules)
 *   - 'just-added':  channels added to watchlist within the last 7 days
 */
export type DiscoverSurface = 'all' | 'spiking-now' | 'just-added'

export interface FetchDiscoverFeedOptions {
  /**
   * Legacy mode parameter retained for callers that haven't migrated to
   * `surface` yet. 'hot' maps to 'just-added' semantics, 'all' maps to 'all'.
   * Prefer `surface` for new code.
   */
  mode?: DiscoverFeedMode
  /** Soft cap on rows returned. Defaults change by tier (see DEFAULT_LIMIT
   *  / PREMIUM_LIMIT below). Caller can override for "Show more" expansions. */
  limit?: number
  /**
   * When 'premium', the 14-day window cap is dropped and a larger fetch
   * budget is used so paying users can browse the full niche pool, not
   * just recent additions. Free/Basic keep the windowed Hot mode so the
   * top of their grid feels alive (fresh discoveries first), with the
   * paywall still gating how many of those they can actually see.
   */
  tier?: UserTier
  /**
   * Sprint Y: surface tab. Replaces `mode` for new callers.
   *   - 'all' (default) — top-ranked by opportunity_score
   *   - 'spiking-now' — only niches passing isSpikingNow() (content-type-aware)
   *   - 'just-added' — promoted to watchlist in the last 7 days
   */
  surface?: DiscoverSurface
  /**
   * Sprint Y: filter by category_enum values (e.g. ['ai_tools', 'crypto']).
   * Empty array or undefined = no category filter.
   * Use bucketToEnumValues() from categoryBuckets.ts to translate the 7
   * user-facing buckets into the 1-3 enum values each maps to.
   */
  categories?: string[]
}

const DEFAULT_LIMIT = 60
const PREMIUM_LIMIT = 200
const HOT_WINDOW_DAYS = 14
const JUST_ADDED_WINDOW_DAYS = 7

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
  const tier = opts.tier ?? 'free'
  const isPremium = tier === 'premium'
  const limit = opts.limit ?? (isPremium ? PREMIUM_LIMIT : DEFAULT_LIMIT)
  const supabase = createClient()
  const categories = opts.categories ?? []

  // Resolve the surface. New `surface` param wins; otherwise fall back to
  // legacy `mode`. 'hot' is treated as 'just-added' for backward-compat
  // but with the original 14-day Hot window kept (not 7d) so callers
  // explicitly using mode='hot' don't see a sudden window shrink.
  const surface: DiscoverSurface | 'legacy-hot' = opts.surface
    ?? (opts.mode === 'hot' ? 'legacy-hot' : 'all')

  // 'just-added' / legacy 'hot' both go through the watchlist-join path.
  // The window differs: 7 days for the new just-added tab, 14 days for
  // the legacy mode='hot' caller (preserves PR #42 behavior).
  if (surface === 'just-added') {
    return fetchWatchlistWindow(supabase, limit, JUST_ADDED_WINDOW_DAYS, categories)
  }
  if (surface === 'legacy-hot') {
    return fetchWatchlistWindow(supabase, limit, HOT_WINDOW_DAYS, categories)
  }

  // 'all' surface (or Premium tier — bypasses any window cap).
  // 'spiking-now' surface ALSO uses fetchAllMode but post-filters via
  // isSpikingNow() because the spike rules are content-type-aware and
  // can't be expressed as a single SQL WHERE in PostgREST. We over-fetch
  // (3x limit) to compensate for the post-filter losing rows, then trim.
  if (surface === 'spiking-now') {
    return fetchAllMode(supabase, limit * 3, categories, /* spikingOnly */ true).then(
      (res) => ({ data: res.data.slice(0, limit), error: res.error }),
    )
  }
  return fetchAllMode(supabase, limit, categories)
}

async function fetchWatchlistWindow(
  supabase: ReturnType<typeof createClient>,
  limit: number,
  windowDays: number,
  categories: string[],
): Promise<{ data: NicheCardData[]; error: string | null }> {
  const cutoffIso = new Date(
    Date.now() - windowDays * 86400 * 1000,
  ).toISOString()

  // Step 1: recent channels by tier_entered_at, capped 2x limit so we
  // have headroom in case some channels have no scan_results yet.
  let watchQuery = supabase
    .from('channels_watchlist')
    .select('youtube_channel_id, tier_entered_at')
    .gte('tier_entered_at', cutoffIso)
    .eq('is_active', true)
    .eq('faceless_verdict', 'faceless')
    .is('evicted_at', null)
    .order('tier_entered_at', { ascending: false, nullsFirst: false })
    .limit(limit * 2)
  if (categories.length > 0) {
    watchQuery = watchQuery.in('category', categories)
  }
  const { data: watchRows, error: watchErr } = await watchQuery

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

  const mapped = scan.slice(0, limit).map((row) => mapRow(row))
  await attachCategories(supabase, mapped)
  return {
    data: mapped,
    error: null,
  }
}

async function fetchAllMode(
  supabase: ReturnType<typeof createClient>,
  limit: number,
  categories: string[] = [],
  spikingOnly = false,
): Promise<{ data: NicheCardData[]; error: string | null }> {
  // Faceless-only feed: gate every surfaced niche on a confirmed
  // faceless_verdict. scan_results_latest doesn't carry the verdict (it
  // lives on channels_watchlist via 0056) nor the category column (0024), so
  // resolve the allowed channel ids first, then filter scan_results by them
  // — the same two-step pattern the category filter already used. The
  // category filter (if any) folds into the same query. Also drops
  // evicted/inactive channels. Reversible: removing the .eq('faceless_verdict')
  // predicate restores the unfiltered feed; no rows are ever deleted.
  let cwQuery = supabase
    .from('channels_watchlist')
    .select('youtube_channel_id')
    .eq('faceless_verdict', 'faceless')
    .eq('is_active', true)
    .is('evicted_at', null)
  if (categories.length > 0) {
    cwQuery = cwQuery.in('category', categories)
  }
  const { data: allowed, error: allowedErr } = await cwQuery
  if (allowedErr) return { data: [], error: 'Discover fetch failed' }
  const allowedIds = (allowed ?? []).map(
    (r: { youtube_channel_id: string }) => r.youtube_channel_id,
  )
  if (allowedIds.length === 0) return { data: [], error: null }

  // Sort by opportunity_score desc to match the visible big number on the
  // card. Users expect "Best first" to mean the score they see, not the
  // raw outlier_ratio (which is a smaller-text supporting metric).
  const { data, error } = await supabase
    .from('scan_results_latest')
    .select('*, niche_clusters(id, label)')
    .in('youtube_channel_id', allowedIds)
    .order('opportunity_score', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) return { data: [], error: 'Discover fetch failed' }
  const rows = (data ?? []) as ScanResultWithCluster[]
  let mapped = rows.map((row) => mapRow(row))

  // Spiking-now post-filter: applied client-side because the rule is
  // content-type-aware and PostgREST can't express the OR-with-different-
  // columns succinctly. Caller over-fetches (3x) to compensate.
  if (spikingOnly) {
    mapped = mapped.filter((n) => isSpikingNow(n))
  }

  await attachCategories(supabase, mapped)
  return { data: mapped, error: null }
}

/**
 * Sprint Y (PR #59): merge category_enum from channels_watchlist into
 * the niche objects in place. The category drives the user-facing
 * sub-label on each card (Finance, Tech & AI, etc.) — without it, the
 * card falls back to nicheLabel which is often the seed-keyword that
 * found the channel ("Dark History of") regardless of the actual topic.
 *
 * Mutates the input array in place. Idempotent on re-call.
 */
export async function attachCategories(
  supabase: ReturnType<typeof createClient>,
  niches: NicheCardData[],
): Promise<void> {
  if (niches.length === 0) return
  const channelIds = niches.map((n) => n.youtubeChannelId).filter(Boolean) as string[]
  if (channelIds.length === 0) return
  const { data, error } = await supabase
    .from('channels_watchlist')
    .select('youtube_channel_id, category')
    .in('youtube_channel_id', channelIds)
  if (error) return // Best-effort: card just falls back to nicheLabel.
  const catByChannel = new Map<string, string | null>()
  for (const row of (data ?? []) as Array<{ youtube_channel_id: string; category: string | null }>) {
    catByChannel.set(row.youtube_channel_id, row.category)
  }
  for (const niche of niches) {
    const cat = catByChannel.get(niche.youtubeChannelId)
    if (cat) niche.category = cat
  }
}
