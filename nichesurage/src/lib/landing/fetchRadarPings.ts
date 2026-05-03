import { createStaticClient } from '@/lib/supabase/staticClient'

export interface RadarPing {
  id: string
  outlierRatio: number
  clusterLabel: string | null
  language: string
  contentType: 'shorts' | 'longform'
}

export interface RadarSnapshot {
  pings: RadarPing[]
  channelsLast24h: number
}

/**
 * Pull a small set of recent outlier scan_results to power the live-radar
 * hero element. Anonymized (no channel id, no name, no url) — we only need
 * the outlier ratio + cluster label + language to render a "Channel
 * discovered" pulse on the radar.
 *
 * The page is statically rendered with revalidate=1800, so this runs at
 * build/revalidate time. The radar then loops through the cached snapshot
 * on the client, which is what the user signed off on (hybrid approach).
 */
export async function fetchRadarPings(): Promise<RadarSnapshot> {
  const supabase = createStaticClient()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  // The cluster-outliers cron only runs once a day (04:00 UTC). Any outliers
  // detected after that are still unclustered until the next run. Limiting
  // hero pings to the last 24h means we frequently end up with zero labeled
  // pings (especially right after a big scan burst). 7 days is well within
  // retention (spike rows live 60d) and reliably contains clustered material.
  const sincePings = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // 1) snapshot of recent outlier pings — we want the freshest 12 so the
  //    radar feed has variety when it loops.
  //
  //    Filter cluster_id IS NOT NULL at the query level: a hero ping
  //    without an AI-generated cluster label is theatre with no story
  //    ("53.0× outlier · Forming cluster" reads as half-finished). Pre-
  //    cluster orphans wait for the next cluster-outliers cron run before
  //    they're eligible for this feed.
  const { data: rows, error } = await supabase
    .from('scan_results_latest')
    .select('id, outlier_ratio, language, content_type, niche_clusters(label)')
    .eq('is_spike', true)
    .gte('scanned_at', sincePings)
    .not('cluster_id', 'is', null)
    .order('outlier_ratio', { ascending: false })
    .limit(12)

  if (error || !rows) {
    if (error) console.error('[fetchRadarPings]', error.message)
    return { pings: [], channelsLast24h: 0 }
  }

  const allPings: RadarPing[] = (rows as RadarPingRow[]).map((row) => ({
    id: row.id,
    outlierRatio: Number(row.outlier_ratio ?? 0),
    clusterLabel: extractClusterLabel(row.niche_clusters),
    language: row.language ?? 'en',
    contentType: row.content_type === 'longform' ? 'longform' : 'shorts',
  }))

  // Defence in depth — query already filters cluster_id IS NOT NULL, but
  // a clustered row could in principle have a null label if labeling failed
  // halfway. Drop those too. Empty array is preferred over a "Forming
  // cluster" placeholder in the hero spot.
  const pings = allPings.filter(p => p.clusterLabel !== null)

  // 2) total count of channels with a spike in the last 24h (for the
  //    "Live · N channels in last 24h" counter — kept at 24h because the
  //    counter is a freshness signal, not a curation feed).
  const { count, error: countError } = await supabase
    .from('scan_results_latest')
    .select('id', { count: 'exact', head: true })
    .eq('is_spike', true)
    .gte('scanned_at', since24h)

  if (countError) {
    console.error('[fetchRadarPings] count', countError.message)
  }

  return {
    pings,
    channelsLast24h: count ?? pings.length,
  }
}

// Supabase nested-select returns the joined row as either an object or
// an array depending on the relationship cardinality. Normalize both.
type ClusterJoin = { label: string | null } | { label: string | null }[] | null

interface RadarPingRow {
  id: string
  outlier_ratio: number | null
  language: string | null
  content_type: string | null
  niche_clusters: ClusterJoin
}

function extractClusterLabel(join: ClusterJoin): string | null {
  if (!join) return null
  if (Array.isArray(join)) return join[0]?.label ?? null
  return join.label ?? null
}
