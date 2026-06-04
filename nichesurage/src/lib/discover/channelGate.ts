import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Shared faceless quality gate for every INTERNAL (in-app) discover surface.
 *
 * Returns the set of `youtube_channel_id`s allowed to appear in the
 * faceless-only product:
 *   faceless_verdict = 'faceless' AND is_active = true AND evicted_at IS NULL
 * (plus an optional category filter).
 *
 * Every internal read path that pulls from `scan_results_latest` — the
 * /discover All tab, Similar Niches, niche-detail-by-id, search/Sonar, hot,
 * trending clusters, and the daily free-demo pick — intersects its query with
 * this set via `.in('youtube_channel_id', allowedIds)`. That keeps the surfaces
 * consistent: a channel can never show up in one place (e.g. "Similar Niches")
 * while being absent from "All". Public landing-page reads intentionally do NOT
 * use this gate (anonymised marketing teaser).
 *
 * Context-agnostic: accepts any Supabase client (browser, server, or
 * service-role) via the structural `Pick<SupabaseClient, 'from'>` type, so it
 * is callable from both client components and server/service code paths.
 *
 * Fail-closed: on a query error it returns `[]`, so a transient DB failure
 * blanks the gated surface rather than leaking non-faceless channels.
 *
 * Lives in its own module (not in fetchDiscoverFeed.ts) to avoid widening the
 * existing fetchDiscoverFeed.ts ⇄ queries.ts import cycle.
 */
export async function getAllowedChannelIds(
  supabase: Pick<SupabaseClient, 'from'>,
  categories: string[] = [],
): Promise<string[]> {
  let query = supabase
    .from('channels_watchlist')
    .select('youtube_channel_id')
    .eq('faceless_verdict', 'faceless')
    .eq('is_active', true)
    .is('evicted_at', null)
  if (categories.length > 0) {
    query = query.in('category', categories)
  }
  const { data, error } = await query
  if (error) return []
  return ((data ?? []) as Array<{ youtube_channel_id: string }>).map(
    (r) => r.youtube_channel_id,
  )
}
