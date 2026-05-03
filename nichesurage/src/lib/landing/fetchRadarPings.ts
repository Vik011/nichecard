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
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // 1) snapshot of recent outlier pings — we want the freshest 12 so the
  //    radar feed has variety when it loops.
  const { data: rows, error } = await supabase
    .from('scan_results_latest')
    .select('id, outlier_ratio, language, content_type, niche_clusters(label)')
    .eq('is_spike', true)
    .gte('scanned_at', since)
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

  // Hero spot is performance theater — every ping needs a cluster label as
  // its narrative. Without one ("Forming cluster" placeholder), even a
  // dramatic ratio reads as half-baked. Strict: drop ALL unlabeled pings.
  // If we're left with too few, fall back to unlabeled to avoid an empty
  // radar — but that fallback is the rare degenerate case.
  const labeled = allPings.filter(p => p.clusterLabel !== null)
  const pings = labeled.length >= 1 ? labeled : allPings

  // 2) total count of channels with a spike in the last 24h (for the
  //    "Live · N channels in last 24h" counter).
  const { count, error: countError } = await supabase
    .from('scan_results_latest')
    .select('id', { count: 'exact', head: true })
    .eq('is_spike', true)
    .gte('scanned_at', since)

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
