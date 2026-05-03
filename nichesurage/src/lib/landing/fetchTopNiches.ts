import { createStaticClient } from '@/lib/supabase/staticClient'
import { mapRow } from '@/lib/supabase/queries'
import type { NicheCardData } from '@/lib/types'
import type { DbScanResult } from '@/lib/types'

export function deterministicChannelNum(channelId: string): string {
  let h = 0
  for (let i = 0; i < channelId.length; i++) {
    h = (Math.imul(31, h) + channelId.charCodeAt(i)) | 0
  }
  return String((Math.abs(h) % 900) + 100)
}

export async function fetchTopNiches(): Promise<NicheCardData[]> {
  const supabase = createStaticClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('scan_results_latest')
    .select('*')
    .gte('scanned_at', since)
    .order('opportunity_score', { ascending: false })
    .limit(6)

  if (error || !data) {
    console.error('[fetchTopNiches]', error?.message ?? 'no data returned')
    return []
  }

  return (data as DbScanResult[]).map((row) => {
    const mapped = mapRow(row)
    return {
      ...mapped,
      channelName: `Hidden Channel #${deterministicChannelNum(row.youtube_channel_id)}`,
      channelUrl: undefined,
      trending: row.spike_multiplier >= 5,
    }
  })
}
