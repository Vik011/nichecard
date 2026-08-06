import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { mapRow, mapWatchlistRow, type WatchlistCatalogRow } from '@/lib/supabase/queries'
import type { DbScanResult } from '@/lib/types/database'
import type { NicheCardData, UserTier } from '@/lib/types'
import { isSpikingNow, isSpikingNowFromMomentum, MOMENTUM_TREND_FLOOR, type ChannelMomentum } from './spike'
import { getAllowedChannelIds } from './channelGate'

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

// Part A "Spiking Now" staleness hotfix: drop scan_results_latest rows whose
// scanned_at is older than the channel's content-type window. A row only stops
// being rewritten once the channel has no in-window outlier >= OUTLIER_DB_FLOOR,
// so a stale scanned_at IS the staleness signal (e.g. NightRegistry's ~7d-old
// shorts row). Shorts use 48h; longform 96h (a current in-window longform outlier
// is rescanned every ~6h, so 96h only drops frozen/stale rows — not live ones).
const SPIKE_FRESH_SHORTS_HOURS = 48
const SPIKE_FRESH_LONGFORM_HOURS = 96

// Read at call time (not module load) so tests can toggle it per-case. In the
// browser bundle Next.js inlines this NEXT_PUBLIC_ access at build time; the
// prefix is REQUIRED because fetchDiscoverFeed runs client-side. Default ON;
// set NEXT_PUBLIC_SPIKE_FRESHNESS_GATE=off + REDEPLOY to revert.
function spikeFreshnessGateOn(): boolean {
  return process.env.NEXT_PUBLIC_SPIKE_FRESHNESS_GATE !== 'off'
}

// All-tab inclusion freshness. Default OFF = relaxed: the All tab shows every
// faceless scan_results_latest row regardless of scanned_at age (All is a
// catalog/browse surface, not a live-momentum one). Set
// NEXT_PUBLIC_ALL_TAB_FRESHNESS_GATE=on + REDEPLOY to restore the strict
// 96h/48h inclusion gate on All. The Spiking Now surface keeps the master
// spikeFreshnessGateOn() gate either way, so relaxing All never affects it.
function allTabFreshnessGateOn(): boolean {
  return process.env.NEXT_PUBLIC_ALL_TAB_FRESHNESS_GATE === 'on'
}

// Part B: when ON (default), the Spiking Now badge + Spiking Now tab read the
// channel_current_momentum view (current-momentum signal) instead of legacy
// outlier logic. Read at call time so tests can toggle per-case. NEXT_PUBLIC_
// prefix is REQUIRED — fetchDiscoverFeed runs client-side, so Next inlines this
// at build time. Set NEXT_PUBLIC_SPIKE_MOMENTUM_MODE=off + REDEPLOY to revert
// to legacy isSpikingNow everywhere (badge + tab).
function momentumModeOn(): boolean {
  return process.env.NEXT_PUBLIC_SPIKE_MOMENTUM_MODE !== 'off'
}

// PostgREST .in() is chunked so the momentum lookup never builds an over-long
// URL on the wide surfaces (premium 'all'/'spiking-now' over-fetch to ~600 ids).
const CHANNEL_MOMENTUM_BATCH = 150

// Widest window (longform) for the SQL pre-filter; the per-row content-type
// refine below applies the tighter shorts window.
function spikeFreshnessCutoffIso(): string {
  return new Date(Date.now() - SPIKE_FRESH_LONGFORM_HOURS * 3_600_000).toISOString()
}

type ScanResultWithCluster = DbScanResult & {
  niche_clusters?: { id: string; label: string } | null
}

// Drop rows whose scanned_at exceeds their content-type freshness window.
// No-op when the gate flag is off (legacy behavior). A missing/unparseable
// scanned_at is treated as stale (cannot prove freshness).
function applySpikeFreshnessGate(
  rows: ScanResultWithCluster[],
): ScanResultWithCluster[] {
  if (!spikeFreshnessGateOn()) return rows
  const now = Date.now()
  return rows.filter((row) => {
    if (!row.scanned_at) return false
    const ageH = (now - new Date(row.scanned_at).getTime()) / 3_600_000
    if (!Number.isFinite(ageH)) return false
    const maxH =
      row.content_type === 'shorts'
        ? SPIKE_FRESH_SHORTS_HOURS
        : SPIKE_FRESH_LONGFORM_HOURS
    return ageH <= maxH
  })
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
  client?: SupabaseClient,
): Promise<{ data: NicheCardData[]; error: string | null }> {
  const tier = opts.tier ?? 'free'
  const isPremium = tier === 'premium'
  const limit = opts.limit ?? (isPremium ? PREMIUM_LIMIT : DEFAULT_LIMIT)
  // PR-C.2: callers (the server endpoint) inject a trusted server client so the
  // feed runs server-side and redaction can happen before serialization. The
  // existing client-side path passes nothing and keeps the browser client.
  const supabase = client ?? createClient()
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
  supabase: SupabaseClient,
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

  // Step 2: scan_results_latest for those channels. Apply the freshness
  // pre-filter (Part A) before order/limit so stale rows don't crowd out
  // fresh ones; the SQL gate is the widest window, the JS refine tightens it.
  let scanQuery = supabase
    .from('scan_results_latest')
    .select('*, niche_clusters(id, label)')
    .in('youtube_channel_id', channelIds)
  if (spikeFreshnessGateOn()) {
    scanQuery = scanQuery.gte('scanned_at', spikeFreshnessCutoffIso())
  }
  const { data: scanRows, error: scanErr } = await scanQuery.limit(limit * 2)

  if (scanErr) return { data: [], error: 'Discover fetch failed' }
  const scan = applySpikeFreshnessGate((scanRows ?? []) as ScanResultWithCluster[])

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
  // Just-added keeps its score+recency ordering. We do NOT attach momentum here
  // (the channel_current_momentum view query slowed initial load). In momentum
  // mode set an explicit false so NicheCard does not fall back to the legacy
  // isSpikingNow badge; flag OFF leaves it undefined → legacy badge (rollback).
  if (momentumModeOn()) {
    for (const n of mapped) n.spikingNow = false
  }
  await attachCategories(supabase, mapped)
  return {
    data: mapped,
    error: null,
  }
}

// B.3.1: View-first path for the Spiking Now tab when momentum mode is ON.
// Queries channel_current_momentum for eligible spiking channels, intersects
// with allowedIds to enforce the faceless/evicted/category gate, then fetches
// scan_results_latest rows for card rendering WITHOUT the Part A freshness gate.
// (The view already proves freshness via video_snapshots.scanned_at through the
// last_metric_age_hours ≤ 26 condition inside current_eligible.)
async function fetchSpikingNowMomentum(
  supabase: SupabaseClient,
  limit: number,
  allowedIds: string[],
): Promise<{ data: NicheCardData[]; error: string | null }> {
  const allowedSet = new Set(allowedIds)

  const { data: momData, error: momErr } = await supabase
    .from('channel_current_momentum')
    .select(
      'youtube_channel_id, content_type, best_video_id, best_video_age_hours, ' +
        'last_metric_age_hours, snapshot_count, trend_score, lifecycle_status, ' +
        'velocity_delta, views_per_hour, current_eligible, last_snapshot_at',
    )
    .eq('current_eligible', true)
    .gte('trend_score', MOMENTUM_TREND_FLOOR)

  if (momErr) return { data: [], error: null } // best-effort: empty tab on view error

  const allMomRows = (momData ?? []) as unknown as ChannelMomentum[]

  // Intersect with allowedIds; JS filter also double-checks DB predicates
  // (defense-in-depth, also makes unit-test mocks straightforward).
  const eligible = allMomRows.filter(
    (r) =>
      allowedSet.has(r.youtube_channel_id) &&
      r.current_eligible === true &&
      (r.trend_score ?? 0) >= MOMENTUM_TREND_FLOOR,
  )
  if (eligible.length === 0) return { data: [], error: null }

  const spikingIds = eligible.map((r) => r.youtube_channel_id)
  const momentumByChannel = new Map<string, ChannelMomentum>()
  for (const r of eligible) momentumByChannel.set(r.youtube_channel_id, r)

  const { data: scanData, error: scanErr } = await supabase
    .from('scan_results_latest')
    .select('*, niche_clusters(id, label)')
    .in('youtube_channel_id', spikingIds)

  if (scanErr) return { data: [], error: 'Discover fetch failed' }

  const mapped = ((scanData ?? []) as ScanResultWithCluster[]).map((row) => mapRow(row))

  for (const niche of mapped) {
    const m = momentumByChannel.get(niche.youtubeChannelId)
    niche.spikingNow = true
    if (m) {
      niche.momentumTrendScore = m.trend_score ?? undefined
      niche.momentumViewsPerHour = m.views_per_hour ?? undefined
      niche.momentumLifecycleStatus = m.lifecycle_status
      niche.momentumVideoId = m.best_video_id
    }
  }

  mapped.sort(compareSpikingTab)
  return { data: mapped.slice(0, limit), error: null }
}

async function fetchAllMode(
  supabase: SupabaseClient,
  limit: number,
  categories: string[] = [],
  spikingOnly = false,
): Promise<{ data: NicheCardData[]; error: string | null }> {
  // Faceless-only feed: resolve the allowed channel ids first (faceless_verdict
  // = 'faceless', active, not evicted, plus optional category), then filter
  // scan_results_latest by them — that table carries neither the verdict (it
  // lives on channels_watchlist via 0056) nor the category column (0024). The
  // shared getAllowedChannelIds() helper is the same gate every other internal
  // surface uses, so a channel can't appear elsewhere but be absent here.
  // Fail-closed: a gate-query error resolves to [] → empty feed, never a leak.
  const allowedIds = await getAllowedChannelIds(supabase, categories)
  if (allowedIds.length === 0) return { data: [], error: null }

  // B.3.1: Spiking Now + momentum ON → query the view first; skip scan_results
  // entirely as the candidate source. Channels with a stale scan_results.scanned_at
  // (rejected by Part A's freshness gate) but active video_snapshots (proving
  // current freshness in the view) are correctly surfaced this way.
  if (spikingOnly && momentumModeOn()) {
    const res = await fetchSpikingNowMomentum(supabase, limit, allowedIds)
    await attachCategories(supabase, res.data)
    return res
  }

  // Sort by opportunity_score desc to match the visible big number on the
  // card. Users expect "Best first" to mean the score they see, not the
  // raw outlier_ratio (which is a smaller-text supporting metric).
  //
  // Over-fetch when the freshness gate is ON (and we aren't already over-
  // fetching for spiking-now): the SQL gate uses the wide 96h window, so the
  // tighter per-content-type JS refine can drop stale Shorts rows (48-96h) the
  // DB returned within `limit` — over-fetching keeps fresh lower-ranked rows
  // from being crowded out. Trimmed back to `limit` after refinement.
  // Freshness applies to the Spiking legacy path (spikingOnly, master gate) but
  // NOT to the All tab unless its own opt-in flag is on (default off = relaxed).
  // This is the PR 1 relax: All becomes a catalog of every faceless scan row,
  // not just those scanned within 96h. Spiking Now is untouched.
  const applyFreshness = spikingOnly ? spikeFreshnessGateOn() : allTabFreshnessGateOn()
  const rawLimit = applyFreshness && !spikingOnly ? limit * 3 : limit
  let scanQuery = supabase
    .from('scan_results_latest')
    .select('*, niche_clusters(id, label)')
    .in('youtube_channel_id', allowedIds)
  if (applyFreshness) {
    scanQuery = scanQuery.gte('scanned_at', spikeFreshnessCutoffIso())
  }
  const { data, error } = await scanQuery
    .order('opportunity_score', { ascending: false, nullsFirst: false })
    .limit(rawLimit)
  if (error) return { data: [], error: 'Discover fetch failed' }
  const rows = applyFreshness
    ? applySpikeFreshnessGate((data ?? []) as ScanResultWithCluster[])
    : ((data ?? []) as ScanResultWithCluster[])
  let mapped = rows.map((row) => mapRow(row))

  if (spikingOnly) {
    // Legacy revert path only (NEXT_PUBLIC_SPIKE_MOMENTUM_MODE=off).
    // momentumModeOn() = true short-circuits above via fetchSpikingNowMomentum.
    mapped = mapped.filter((n) => isSpikingNow(n))
    mapped = mapped.slice(0, limit)
  } else {
    // All tab. Segment 1 = scan_results_latest rows (opportunity_score DESC,
    // SQL already applied it) — the proven outlier performers, byte-for-byte
    // unchanged. We do NOT query channel_current_momentum here — that view
    // aggregates video_snapshots per request and was the initial-load
    // bottleneck. Spiking badges + pinning live only on the Spiking Now tab.
    const seg1 = mapped.slice(0, limit)
    const seg1Ids = new Set(seg1.map((n) => n.youtubeChannelId))

    // ── PR 4 Segment 2: catalog-only channels ────────────────────────────
    // Faceless channels that passed the gate (allowedIds) but produced no
    // scan_results row (no ≥2× outlier) and have populated catalog fields.
    // Sourced straight from channels_watchlist, appended AFTER Segment 1.
    // allowedIds already enforces faceless_verdict='faceless' + is_active +
    // evicted_at IS NULL + the category filter, so Segment 2 only adds the
    // NOT-NULL catalog requirements and its own ordering.
    const catalogIds = allowedIds.filter((id) => !seg1Ids.has(id))
    let seg2: NicheCardData[] = []
    if (catalogIds.length > 0) {
      const { data: wlData, error: wlErr } = await supabase
        .from('channels_watchlist')
        .select(
          'youtube_channel_id, channel_name, niche_label, content_type, language, category, subscriber_count, video_count, last_upload_at, first_discovered_at',
        )
        .in('youtube_channel_id', catalogIds)
        .not('subscriber_count', 'is', null)
        .not('video_count', 'is', null)
        .not('last_upload_at', 'is', null)
        .order('subscriber_count', { ascending: false, nullsFirst: false })
        .order('last_upload_at', { ascending: false, nullsFirst: false })
        .limit(limit)
      // Fail-soft: a Segment 2 error must never blank Segment 1.
      if (!wlErr) {
        seg2 = ((wlData ?? []) as WatchlistCatalogRow[]).map((r) => mapWatchlistRow(r))
      }
    }

    // Dedupe by channel, enriched (Segment 1) wins; append Segment 2 after.
    const merged = [...seg1, ...seg2.filter((n) => !seg1Ids.has(n.youtubeChannelId))]
    mapped = merged.slice(0, limit)
    if (momentumModeOn()) {
      // Explicit false (not undefined) so NicheCard does not fall back to the
      // legacy isSpikingNow badge on this surface. Catalog cards already carry
      // spikingNow=false from mapWatchlistRow; leave them as-is.
      for (const n of mapped) if (!n.catalogOnly) n.spikingNow = false
    }
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
  supabase: SupabaseClient,
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

// ─── Part B: momentum attach + ordering ──────────────────────────────────────

/**
 * Spiking Now tab order: momentumTrendScore DESC, then momentumViewsPerHour
 * DESC, then opportunityScore DESC. Every row reaching this comparator already
 * passed spikingNow === true, so the momentum fields are populated.
 */
function compareSpikingTab(a: NicheCardData, b: NicheCardData): number {
  const t = (b.momentumTrendScore ?? 0) - (a.momentumTrendScore ?? 0)
  if (t !== 0) return t
  const v = (b.momentumViewsPerHour ?? 0) - (a.momentumViewsPerHour ?? 0)
  if (v !== 0) return v
  return (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0)
}

/**
 * Part B: batch-read the channel_current_momentum view for the given niches and
 * attach the current-momentum signal in place.
 *
 * Sets `spikingNow` to an EXPLICIT boolean on EVERY niche (default false). The
 * explicit-false default is load-bearing: it stops NicheCard's
 * `data.spikingNow ?? isSpikingNow(data)` from falling back to legacy inside the
 * momentum feed — a channel absent from the view is spikingNow=false, full stop.
 *
 * The view already encodes every eligibility gate (snapshot freshness, video
 * age, lifecycle, snapshot_count >= 2, content_type known) in current_eligible;
 * isSpikingNowFromMomentum only adds the calibrated trend floor on top. SQL
 * gates are not re-derived here.
 *
 * Best-effort: on a view error every niche stays spikingNow=false (fail-safe —
 * the Spiking Now tab goes empty rather than showing false positives, and we
 * never fall back to legacy on the momentum surface). Mutates in place.
 */
export async function attachMomentum(
  supabase: SupabaseClient,
  niches: NicheCardData[],
): Promise<void> {
  if (niches.length === 0) return
  for (const n of niches) n.spikingNow = false

  const channelIds = niches
    .map((n) => n.youtubeChannelId)
    .filter(Boolean) as string[]
  if (channelIds.length === 0) return

  const byChannel = new Map<string, ChannelMomentum>()
  for (let i = 0; i < channelIds.length; i += CHANNEL_MOMENTUM_BATCH) {
    const batch = channelIds.slice(i, i + CHANNEL_MOMENTUM_BATCH)
    const { data, error } = await supabase
      .from('channel_current_momentum')
      .select(
        'youtube_channel_id, content_type, best_video_id, best_video_age_hours, ' +
          'last_metric_age_hours, snapshot_count, trend_score, lifecycle_status, ' +
          'velocity_delta, views_per_hour, current_eligible, last_snapshot_at',
      )
      .in('youtube_channel_id', batch)
    if (error) return // best-effort: every card stays spikingNow=false
    // channel_current_momentum is a view (not in the generated Database types),
    // so PostgREST types `data` loosely — cast through unknown to ChannelMomentum.
    for (const row of (data ?? []) as unknown as ChannelMomentum[]) {
      byChannel.set(row.youtube_channel_id, row)
    }
  }

  for (const niche of niches) {
    const m = byChannel.get(niche.youtubeChannelId)
    niche.spikingNow = isSpikingNowFromMomentum(m)
    if (m) {
      niche.momentumTrendScore = m.trend_score ?? undefined
      niche.momentumViewsPerHour = m.views_per_hour ?? undefined
      niche.momentumLifecycleStatus = m.lifecycle_status
      niche.momentumVideoId = m.best_video_id
    }
  }
}
