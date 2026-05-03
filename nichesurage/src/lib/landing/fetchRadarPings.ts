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

  // 1) snapshot of recent outlier pings.
  //    NOTE: we deliberately do NOT use a PostgREST embedded select like
  //    `niche_clusters(label)` here. The /discover page uses that pattern
  //    successfully but it queries with an authenticated browser client.
  //    fetchRadarPings runs at build/revalidate time with the anon key via
  //    createStaticClient, and the embedded join was returning an empty
  //    result set in production despite labeled rows existing in the DB
  //    (the parallel count query below — which doesn't traverse the join —
  //    consistently returned non-zero, confirming anon CAN read scan_results
  //    but the embed wasn't materializing). Two separate queries + a manual
  //    Map join is identical in result and removes the moving part.
  const { data: scanRows, error } = await supabase
    .from('scan_results_latest')
    .select('id, outlier_ratio, language, content_type, cluster_id')
    .eq('is_spike', true)
    .gte('scanned_at', sincePings)
    .not('cluster_id', 'is', null)
    .order('outlier_ratio', { ascending: false })
    .limit(50)

  if (error || !scanRows) {
    if (error) console.error('[fetchRadarPings] scans', error.message)
    return { pings: [], channelsLast24h: 0 }
  }

  // Hydrate cluster labels in a second query and build a lookup Map.
  const clusterIds = Array.from(
    new Set(scanRows.map((r) => (r as ScanRow).cluster_id).filter((id): id is string => !!id)),
  )

  const labelsById = new Map<string, string>()
  if (clusterIds.length > 0) {
    const { data: clusters, error: clusterErr } = await supabase
      .from('niche_clusters')
      .select('id, label')
      .in('id', clusterIds)

    if (clusterErr) {
      console.error('[fetchRadarPings] clusters', clusterErr.message)
    } else if (clusters) {
      for (const c of clusters as Array<{ id: string; label: string | null }>) {
        if (c.label) labelsById.set(c.id, c.label)
      }
    }
  }

  const allPings: RadarPing[] = (scanRows as ScanRow[]).map((row) => ({
    id: row.id,
    outlierRatio: Number(row.outlier_ratio ?? 0),
    clusterLabel: row.cluster_id ? labelsById.get(row.cluster_id) ?? null : null,
    language: row.language ?? 'en',
    contentType: row.content_type === 'longform' ? 'longform' : 'shorts',
  }))

  // Final label filter, then trim to 12 for the rotation feed. Empty array
  // is preferred over a placeholder — but with a 50-row pool over 7 days
  // and explicit cluster-id filter, we virtually never hit zero.
  const pings = allPings.filter((p) => p.clusterLabel !== null).slice(0, 12)

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

interface ScanRow {
  id: string
  outlier_ratio: number | null
  language: string | null
  content_type: string | null
  cluster_id: string | null
}
