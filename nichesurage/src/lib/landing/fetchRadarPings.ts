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
  //    PR-C.1 (C1): anon can no longer read scan_results_latest directly
  //    (0068 revokes it), so the ping pool now comes from the safe
  //    public_landing_niches() RPC (0067), which returns the same
  //    non-identity columns this radar needs (id, outlier_ratio, language,
  //    content_type, cluster_id) and applies the same latest-per-channel +
  //    quality-floor logic the old view did.
  //
  //    Cluster labels are still hydrated in a SEPARATE query against
  //    niche_clusters below (anon read of niche_clusters is unchanged by
  //    PR-C.1). We deliberately do NOT use a PostgREST embedded select like
  //    `niche_clusters(label)` here: the embedded join returned an empty
  //    result set under the anon key in production despite labeled rows
  //    existing, so the two-query + manual Map join is kept.
  const { data: scanData, error } = await supabase
    .rpc('public_landing_niches')
    .select('id, outlier_ratio, language, content_type, cluster_id')
    .eq('is_spike', true)
    .gte('scanned_at', sincePings)
    .not('cluster_id', 'is', null)
    .order('outlier_ratio', { ascending: false })
    .limit(50)

  if (error || !scanData) {
    if (error) console.error('[fetchRadarPings] scans', error.message)
    return { pings: [], channelsLast24h: 0 }
  }

  // The static (anon) client is untyped, so the RPC result comes back loosely
  // typed; the projection above guarantees these columns.
  const scanRows = scanData as unknown as ScanRow[]

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
  //    counter is a freshness signal, not a curation feed). Same safe RPC as
  //    above; count + head go in the rpc() options arg.
  const { count, error: countError } = await supabase
    .rpc('public_landing_niches', undefined, { count: 'exact', head: true })
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
