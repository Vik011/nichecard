import { createStaticClient } from '@/lib/supabase/staticClient'

export interface RadarPing {
  id: string
  outlierRatio: number
  // Coarse, content-type-derived label — NEVER the real niche_clusters.label.
  // PR-C.1 (C1/J1): a logged-out visitor must not see a specific niche/cluster
  // name, so this is always one of the coarseLabel() values below. Do NOT
  // re-point this at niche_clusters.label or any per-channel niche field.
  clusterLabel: string | null
  language: string
  contentType: 'shorts' | 'longform'
}

export interface RadarSnapshot {
  pings: RadarPing[]
  channelsLast24h: number
}

// Coarse, non-identifying radar label. The logged-out landing must not expose a
// real niche/cluster name (PR-C.1 / J1), so the ping shows only a content-type
// descriptor. Anything other than shorts/longform falls back to a generic tag.
function coarseLabel(contentType: 'shorts' | 'longform'): string {
  if (contentType === 'shorts') return 'Faceless Shorts'
  if (contentType === 'longform') return 'Faceless Long-form'
  return 'Hidden niche'
}

/**
 * Pull a small set of recent outlier scan_results to power the live-radar hero
 * element. Fully anonymized — no channel id/name/url, and (PR-C.1) no real
 * niche/cluster label either: the ping label is a coarse content-type
 * descriptor derived locally, never niche_clusters.label.
 *
 * The page is statically rendered with revalidate=1800, so this runs at
 * build/revalidate time. The radar then loops through the cached snapshot on
 * the client, which is what the user signed off on (hybrid approach).
 */
export async function fetchRadarPings(): Promise<RadarSnapshot> {
  const supabase = createStaticClient()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  // The cluster-outliers cron only runs once a day (04:00 UTC); outliers found
  // after that stay unclustered until the next run. 7 days is well within
  // retention (spike rows live 60d) and reliably contains clustered material.
  const sincePings = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // 1) snapshot of recent outlier pings, via the safe public_landing_niches()
  //    RPC (0067) — anon can no longer read scan_results_latest directly (0068).
  //    `cluster_id` is kept ONLY as an internal selection filter (we ping
  //    channels that have been clustered = a meaningful wave); the real cluster
  //    LABEL is never fetched or rendered (PR-C.1 / J1), so niche_clusters is no
  //    longer queried on the landing path.
  const { data: scanData, error } = await supabase
    .rpc('public_landing_niches')
    .select('id, outlier_ratio, language, content_type')
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

  const pings: RadarPing[] = scanRows
    .map((row) => {
      const contentType: RadarPing['contentType'] =
        row.content_type === 'longform' ? 'longform' : 'shorts'
      return {
        id: row.id,
        outlierRatio: Number(row.outlier_ratio ?? 0),
        clusterLabel: coarseLabel(contentType),
        language: row.language ?? 'en',
        contentType,
      }
    })
    .slice(0, 12)

  // 2) total count of channels with a spike in the last 24h (for the
  //    "Live · N channels in last 24h" counter — kept at 24h because the
  //    counter is a freshness signal, not a curation feed). Same safe RPC;
  //    count + head go in the rpc() options arg.
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
}
