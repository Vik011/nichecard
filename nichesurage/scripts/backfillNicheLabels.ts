// nichesurage/scripts/backfillNicheLabels.ts
//
// One-shot backfill: fill empty niche_label rows in channels_watchlist
// using the same Anthropic Haiku flow as the discover/trending insert path.
//
// Usage:
//   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  YOUTUBE_API_KEY=...
//   ANTHROPIC_API_KEY=...  npx tsx nichesurage/scripts/backfillNicheLabels.ts
//
//   Optional: YOUTUBE_API_KEY_2=... — secondary key, used as quota fallback
//   (mirrors the rotation pattern from supabase/functions/_shared/youtube.ts).
//
//   Add --dry-run to print proposed updates without writing.
//
// Default batch: 500 rows. Limits configurable via BATCH_SIZE env var.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? '500', 10)
const DRY_RUN = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !process.env.YOUTUBE_API_KEY || !ANTHROPIC_API_KEY) {
  console.error('Missing env: need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY, ANTHROPIC_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const YT = 'https://www.googleapis.com/youtube/v3'

// Node-equivalent of supabase/functions/_shared/youtube.ts key-rotation helpers.
// Cannot import directly because that module uses Deno.env; this script is Node.
function getYoutubeKeys(): string[] {
  const primary = process.env.YOUTUBE_API_KEY
  const secondary = process.env.YOUTUBE_API_KEY_2
  if (!primary) throw new Error('YOUTUBE_API_KEY not set')
  return secondary ? [primary, secondary] : [primary]
}

function isQuotaError(status: number, body: string): boolean {
  if (status !== 403) return false
  const lower = body.toLowerCase()
  return lower.includes('quota') || lower.includes('ratelimitexceeded')
}

async function ytFetch(
  buildUrl: (key: string) => string,
  endpoint: string,
): Promise<Response> {
  const keys = getYoutubeKeys()
  let lastErr: Error | null = null
  for (let i = 0; i < keys.length; i++) {
    const res = await fetch(buildUrl(keys[i]))
    if (res.ok) return res
    const body = await res.clone().text()
    if (isQuotaError(res.status, body) && i < keys.length - 1) {
      console.warn(`${endpoint}: quota on key #${i + 1}, falling back to key #${i + 2}`)
      lastErr = new Error(`${endpoint} quota on key ${i + 1}: ${body.slice(0, 120)}`)
      continue
    }
    return res // non-quota failure: return as-is so caller can inspect res.ok
  }
  throw lastErr ?? new Error(`${endpoint}: all YouTube API keys exhausted`)
}

interface WatchlistRow {
  id: string
  youtube_channel_id: string
  channel_name: string
  niche_label: string | null
  seed_keyword: string | null
}

async function fetchUploadsPlaylistId(channelId: string): Promise<string | null> {
  const res = await ytFetch(
    (key) => `${YT}/channels?key=${key}&id=${channelId}&part=contentDetails&maxResults=1`,
    'channels.list',
  )
  if (!res.ok) {
    console.warn(`channels.list ${res.status} for ${channelId}`)
    return null
  }
  const data = await res.json()
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null
}

async function fetchRecentTitles(uploadsPlaylistId: string): Promise<string[]> {
  const playlistRes = await ytFetch(
    (key) => `${YT}/playlistItems?key=${key}&playlistId=${uploadsPlaylistId}&part=contentDetails&maxResults=20`,
    'playlistItems.list',
  )
  if (!playlistRes.ok) return []
  const playlistData = await playlistRes.json()
  const videoIds: string[] = (playlistData.items ?? [])
    .map((it: { contentDetails?: { videoId?: string } }) => it.contentDetails?.videoId)
    .filter(Boolean)
  if (videoIds.length === 0) return []

  const videosRes = await ytFetch(
    (key) => `${YT}/videos?key=${key}&id=${videoIds.join(',')}&part=snippet&maxResults=${videoIds.length}`,
    'videos.list',
  )
  if (!videosRes.ok) return []
  const videosData = await videosRes.json()
  return (videosData.items ?? [])
    .map((it: { snippet?: { title?: string } }) => it.snippet?.title)
    .filter((t: unknown): t is string => typeof t === 'string' && t.length > 0)
}

async function buildLabel(channelName: string, titles: string[], fallback: string): Promise<string> {
  if (titles.length === 0) return fallback
  const titlesText = titles.slice(0, 20).map(t => `- ${t}`).join('\n')
  const prompt = `Given this YouTube channel name and its recent video titles, return a short niche label (2-4 words). Specific, not generic.

Examples of good labels:
- ai prompt engineering
- frugal couple finance
- body recomp for women
- minimalist survival cooking
- faceless stoic productivity

Examples of bad labels (too generic):
- tech, fitness, lifestyle, education

Channel: ${channelName}
Recent video titles:
${titlesText}

Respond with ONLY the niche label, lowercase, no quotes, no preamble.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 30,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return fallback
    const data = await res.json()
    const text = data?.content?.[0]?.text
    if (typeof text !== 'string' || text.trim().length === 0) return fallback
    return text.trim().toLowerCase().slice(0, 40)
  } catch {
    return fallback
  }
}

async function main() {
  console.log(`backfillNicheLabels: dry-run=${DRY_RUN}, batch=${BATCH_SIZE}`)

  const { data: rows, error } = await supabase
    .from('channels_watchlist')
    .select('id, youtube_channel_id, channel_name, niche_label, seed_keyword')
    .or('niche_label.is.null,niche_label.eq.')
    .order('first_discovered_at', { ascending: false })
    .limit(BATCH_SIZE)
  if (error) throw error
  if (!rows || rows.length === 0) {
    console.log('No empty-label rows to backfill.')
    return
  }
  console.log(`Found ${rows.length} rows to backfill.`)

  let updated = 0
  let skipped = 0
  let failed = 0

  for (const row of rows as WatchlistRow[]) {
    try {
      const uploadsId = await fetchUploadsPlaylistId(row.youtube_channel_id)
      if (!uploadsId) {
        console.warn(`no uploads playlist for ${row.youtube_channel_id} (deleted channel?)`)
        skipped++
        continue
      }
      const titles = await fetchRecentTitles(uploadsId)
      const fallback = row.seed_keyword ?? ''
      const label = await buildLabel(row.channel_name, titles, fallback)

      if (label === '' || label === fallback && fallback === '') {
        console.warn(`no label produced for ${row.channel_name}`)
        skipped++
        continue
      }

      if (DRY_RUN) {
        console.log(`[dry-run] ${row.channel_name} → "${label}"`)
        updated++
        continue
      }

      const { error: upErr } = await supabase
        .from('channels_watchlist')
        .update({ niche_label: label })
        .eq('id', row.id)
      if (upErr) {
        console.error(`update failed for ${row.id}:`, upErr)
        failed++
      } else {
        console.log(`${row.channel_name} → "${label}"`)
        updated++
      }
    } catch (err) {
      console.error(`row ${row.id} failed:`, err)
      failed++
    }
  }

  console.log(`\nDone. updated=${updated} skipped=${skipped} failed=${failed}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
