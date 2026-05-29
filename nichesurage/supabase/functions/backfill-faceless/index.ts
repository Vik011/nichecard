// supabase/functions/backfill-faceless/index.ts
//
// ONE-SHOT, MANUAL-INVOKE faceless_verdict backfill. NOT a cron — there is
// intentionally no schedule for this function.
//
//   Invoke from the SQL Editor, one batch at a time:
//       select public.invoke_edge_function('backfill-faceless');
//   Read the returned { done, phase, remaining } and re-invoke until done=true.
//
//   RUN BETWEEN SCAN TICKS (03:30 / 09:30 / 15:30 / 21:30 UTC). The youtube
//   phase shares the YouTube Data API quota with scan + discovery; running it
//   right on a scan tick risks quota contention. Each response echoes the next
//   scan tick so the operator can pace re-invokes.
//
// WHAT IT DOES: fills channels_watchlist.faceless_verdict (faceless|face|
// uncertain) for LIVE rows (evicted_at IS NULL) that are still NULL. Two
// phases, Loop A fully before Loop B:
//   - storedTitles : channels that already have a scan_results.outlier_video_title
//                    (zero YouTube quota — titles read from the DB).
//   - youtube      : channels with no stored title — up to 20 recent upload
//                    titles fetched from the channel's uploads playlist
//                    (~2 quota units/channel). The batched getChannelStats at
//                    the start of a youtube batch doubles as a quota CANARY:
//                    if it throws a quota error, the function aborts before the
//                    per-channel loop so it never burns quota on a 403.
//
// BATCHING: each invoke processes at most MAX_BATCH channels OR until
// SOFT_TIME_BUDGET_MS of wall-clock elapses (checked BEFORE each iteration, so
// a slow Claude/YouTube call cannot overshoot the edge function timeout), then
// returns a partial result. Idempotent (only ever touches faceless_verdict IS
// NULL rows, guarded again at write time), so re-invoking simply continues.
//
// POLICY: ONLY sets faceless_verdict. NEVER evicts a channel, NEVER touches the
// boolean `faceless`, NEVER touches the /discover feed. Eviction of face
// channels is a separate decision to be made after these numbers are in.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getYoutubeKeys, getChannelStats, getRecentVideos } from '../_shared/youtube.ts'
import { classifyFaceless } from '../_shared/faceless.ts'

const MAX_BATCH = parseInt(Deno.env.get('BACKFILL_MAX_BATCH') ?? '50', 10)
const SOFT_TIME_BUDGET_MS = parseInt(Deno.env.get('BACKFILL_TIME_BUDGET_MS') ?? '100000', 10)
const SLEEP_MS = 500 // Claude rate-limit headroom (matches recategorize)
const SCAN_TICKS_UTC: Array<[number, number]> = [[3, 30], [9, 30], [15, 30], [21, 30]]

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Chunk an array into sub-arrays of at most `size`.
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// A thrown YouTube error is a quota exhaustion (vs a transient/other failure).
// _shared/youtube.ts surfaces quota as messages containing "quota" /
// "exhausted" / "rateLimitExceeded".
function isQuotaErr(err: unknown): boolean {
  const s = String(err).toLowerCase()
  return s.includes('quota') || s.includes('exhausted') || s.includes('ratelimitexceeded')
}

function nextScanTickUtc(now: Date): string {
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes()
  for (const [h, m] of SCAN_TICKS_UTC) {
    if (h * 60 + m > nowMin) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} UTC`
  }
  return '03:30 UTC (next day)'
}

interface ChannelRow {
  id: string
  youtube_channel_id: string
  channel_name: string | null
}

function emptyTally() {
  return { processed: 0, updated: 0, faceless: 0, face: 0, uncertain: 0 }
}

Deno.serve(async (_req: Request) => {
  const start = performance.now()
  const elapsed = () => performance.now() - start

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!supabaseUrl) throw new Error('SUPABASE_URL not set')
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set')
    const youtubeKeys = getYoutubeKeys()

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const storedPath = emptyTally()
    const ytPath = { ...emptyTally(), noTitles: 0, quotaAborted: false }

    // Approximate batch number for the operator: how many live rows already
    // have a verdict, divided by the batch size. Derived (the function is
    // stateless across invokes), so it is a running index, not exact.
    const { count: alreadyDone } = await supabase
      .from('channels_watchlist')
      .select('id', { count: 'exact', head: true })
      .is('evicted_at', null)
      .not('faceless_verdict', 'is', null)
    const batchNumber = Math.floor((alreadyDone ?? 0) / MAX_BATCH) + 1

    // Every live row still needing a verdict (lightweight: id + name only).
    const { data: pendingRows, error: pendingErr } = await supabase
      .from('channels_watchlist')
      .select('id, youtube_channel_id, channel_name')
      .is('faceless_verdict', null)
      .is('evicted_at', null)
    if (pendingErr) throw pendingErr
    const pending = (pendingRows ?? []) as ChannelRow[]

    if (pending.length === 0) {
      return json({
        phase: 'complete', batchNumber, done: true, remaining: 0,
        storedPath, ytPath, elapsedMs: Math.round(elapsed()),
        nextScanTickUtc: nextScanTickUtc(new Date()),
        note: 'Nothing left to backfill. Manual invoke only; no further runs needed.',
      })
    }

    // Which pending channels already have a stored outlier title (→ storedTitles
    // phase, zero quota). Chunk the IN() lookup so the URL stays small.
    const withStoredTitle = new Set<string>()
    for (const ids of chunk(pending.map(p => p.youtube_channel_id), 100)) {
      const { data, error } = await supabase
        .from('scan_results')
        .select('youtube_channel_id')
        .not('outlier_video_title', 'is', null)
        .in('youtube_channel_id', ids)
      if (error) throw error
      for (const r of (data ?? []) as { youtube_channel_id: string }[]) {
        withStoredTitle.add(r.youtube_channel_id)
      }
    }

    const storedList = pending.filter(p => withStoredTitle.has(p.youtube_channel_id))
    const ytList = pending.filter(p => !withStoredTitle.has(p.youtube_channel_id))

    // Idempotent write guard: only set the verdict if still NULL.
    async function writeVerdict(id: string, verdict: string): Promise<boolean> {
      const { error } = await supabase
        .from('channels_watchlist')
        .update({ faceless_verdict: verdict })
        .eq('id', id)
        .is('faceless_verdict', null)
      if (error) {
        console.error(`backfill-faceless: update failed for ${id}:`, error)
        return false
      }
      return true
    }

    // ----- Loop A: storedTitles (drains fully before Loop B) -----------------
    if (storedList.length > 0) {
      let processed = 0
      for (const row of storedList) {
        if (elapsed() > SOFT_TIME_BUDGET_MS || processed >= MAX_BATCH) break
        processed++
        storedPath.processed++

        const { data: recent } = await supabase
          .from('scan_results')
          .select('outlier_video_title, scanned_at')
          .eq('youtube_channel_id', row.youtube_channel_id)
          .not('outlier_video_title', 'is', null)
          .order('scanned_at', { ascending: false })
          .limit(5)
        const titles = (recent ?? [])
          .map((r: { outlier_video_title: string | null }) => r.outlier_video_title)
          .filter((t): t is string => typeof t === 'string' && t.length > 0)

        const verdict = await classifyFaceless(row.channel_name ?? '', titles, anthropicKey)
        if (await writeVerdict(row.id, verdict)) storedPath.updated++
        storedPath[verdict as 'faceless' | 'face' | 'uncertain']++
        await sleep(SLEEP_MS)
      }

      const remaining = pending.length - storedPath.updated
      return json({
        phase: 'storedTitles', batchNumber, done: false, remaining,
        storedPath, ytPath, elapsedMs: Math.round(elapsed()),
        nextScanTickUtc: nextScanTickUtc(new Date()),
        note: `storedTitles phase. Re-invoke to continue. Next scan tick at ${nextScanTickUtc(new Date())} — pace re-invokes before it.`,
      })
    }

    // ----- Loop B: youtube (only once Loop A is fully drained) ---------------
    const ytBatch = ytList.slice(0, MAX_BATCH)

    // CANARY: the batched channels.list doubles as the quota probe. If it
    // throws a quota error, abort before the per-channel loop so we never burn
    // the youtube budget on an exhausted key.
    let stats
    try {
      stats = await getChannelStats(youtubeKeys, ytBatch.map(c => c.youtube_channel_id))
    } catch (err) {
      if (isQuotaErr(err)) {
        ytPath.quotaAborted = true
        return json({
          phase: 'youtube', batchNumber, done: false, remaining: pending.length,
          storedPath, ytPath, elapsedMs: Math.round(elapsed()),
          nextScanTickUtc: nextScanTickUtc(new Date()),
          note: 'YouTube quota canary failed (403/quota). Aborted before burning quota. Retry later, ideally just after a quota reset / between scan ticks.',
        })
      }
      throw err
    }
    const uploadsByChannel = new Map(stats.map(s => [s.channelId, s.uploadsPlaylistId]))

    let processed = 0
    for (const row of ytBatch) {
      if (elapsed() > SOFT_TIME_BUDGET_MS || processed >= MAX_BATCH) break
      processed++
      ytPath.processed++

      let titles: string[] = []
      const uploads = uploadsByChannel.get(row.youtube_channel_id)
      if (uploads) {
        try {
          const vids = await getRecentVideos(youtubeKeys, uploads, 20)
          titles = vids.map(v => v.title).filter(t => typeof t === 'string' && t.length > 0)
        } catch (err) {
          // Quota mid-loop → stop the whole loop, return partial. Other errors
          // (transient) → fall through to name-only classification for this row.
          if (isQuotaErr(err)) {
            ytPath.quotaAborted = true
            const remaining = pending.length - ytPath.updated
            return json({
              phase: 'youtube', batchNumber, done: false, remaining,
              storedPath, ytPath, elapsedMs: Math.round(elapsed()),
              nextScanTickUtc: nextScanTickUtc(new Date()),
              note: 'YouTube quota hit mid-loop. Stopped to avoid burning quota. Partial progress saved; re-invoke later.',
            })
          }
          console.warn(`backfill-faceless: getRecentVideos failed for ${row.youtube_channel_id}:`, err)
        }
      }
      if (titles.length === 0) ytPath.noTitles++

      const verdict = await classifyFaceless(row.channel_name ?? '', titles, anthropicKey)
      if (await writeVerdict(row.id, verdict)) ytPath.updated++
      ytPath[verdict as 'faceless' | 'face' | 'uncertain']++
      await sleep(SLEEP_MS)
    }

    const remaining = pending.length - ytPath.updated
    return json({
      phase: 'youtube', batchNumber, done: remaining === 0, remaining,
      storedPath, ytPath, elapsedMs: Math.round(elapsed()),
      nextScanTickUtc: nextScanTickUtc(new Date()),
      note: remaining === 0
        ? 'Backfill complete. Run the verdict-distribution SQL to see the full picture.'
        : `youtube phase. Re-invoke to continue. Next scan tick at ${nextScanTickUtc(new Date())} — pace re-invokes before it.`,
    })
  } catch (err) {
    console.error('backfill-faceless fatal error:', err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
