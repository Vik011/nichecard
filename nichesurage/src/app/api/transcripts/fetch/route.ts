/**
 * Cron route: pull videos lacking transcript_embedding, fetch transcript via
 * yt-dlp, embed via OpenAI, UPSERT video_embeddings.
 *
 * Vercel cron sends GET. We export GET (not POST) for that reason.
 *
 * Capacity: BATCH_SIZE = 20 videos × ~3s yt-dlp each ≈ 60s budget (Pro plan).
 * Newest videos prioritized — those are the trend candidates.
 *
 * Tombstone behavior: when a video has no auto-subs, we still UPSERT a row
 * with embedded_at set so the outer query stops re-picking it. Otherwise
 * every cron tick burns budget on the same un-transcript-able videos.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { fetchTranscript } from '@/lib/transcripts/fetch'
import { buildEmbedding } from '@/lib/embeddings/build'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH_SIZE = 20

function checkCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // not configured = allow (dev / first deploy)
  const got =
    request.headers.get('x-cron-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    null
  return got === secret
}

export async function GET(request: Request) {
  if (!checkCronSecret(request)) {
    return new Response('unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()

  // Find videos that don't yet have a row in video_embeddings (or have a
  // null transcript_embedding AND no embedded_at tombstone). Use a left-join
  // pattern via two queries since PostgREST `.not('video_id','in', subselect)`
  // is not supported — emulate it with a fetch + filter.
  const { data: alreadyEmbedded, error: embErr } = await supabase
    .from('video_embeddings')
    .select('video_id')
    .limit(10_000)
  if (embErr) {
    console.error('[transcripts/fetch] failed listing video_embeddings', embErr)
    return Response.json({ error: 'db error' }, { status: 500 })
  }
  const seen = new Set((alreadyEmbedded ?? []).map((r) => r.video_id as string))

  const { data: candidates, error: candErr } = await supabase
    .from('video_metrics')
    .select('video_id, computed_at')
    .order('computed_at', { ascending: false })
    .limit(BATCH_SIZE * 5) // pull a wider pool, filter client-side
  if (candErr) {
    console.error('[transcripts/fetch] failed listing video_metrics', candErr)
    return Response.json({ error: 'db error' }, { status: 500 })
  }

  const targets =
    (candidates ?? []).filter((c) => !seen.has(c.video_id as string)).slice(0, BATCH_SIZE)

  let processed = 0
  let embedded = 0
  let skipped = 0

  for (const t of targets) {
    const videoId = t.video_id as string
    processed++
    const tr = await fetchTranscript(videoId)
    if (!tr) {
      // Tombstone: mark as attempted so we don't retry every cron tick.
      const { error } = await supabase
        .from('video_embeddings')
        .upsert(
          { video_id: videoId, embedded_at: new Date().toISOString() },
          { onConflict: 'video_id' },
        )
      if (error) console.error('[transcripts/fetch] tombstone upsert failed', videoId, error)
      skipped++
      continue
    }
    try {
      const vec = await buildEmbedding(tr.text)
      const { error } = await supabase
        .from('video_embeddings')
        .upsert(
          {
            video_id: videoId,
            transcript_embedding: vec,
            embedded_at: new Date().toISOString(),
          },
          { onConflict: 'video_id' },
        )
      if (error) {
        console.error('[transcripts/fetch] embed upsert failed', videoId, error)
      } else {
        embedded++
      }
    } catch (err) {
      console.error('[transcripts/fetch] embed failed', videoId, err)
    }
  }

  return Response.json({ processed, embedded, skipped, batch: BATCH_SIZE })
}
