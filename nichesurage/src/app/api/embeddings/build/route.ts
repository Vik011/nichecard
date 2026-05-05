/**
 * Cron route: pull videos lacking title_embedding, embed via OpenAI in one
 * batch, UPSERT video_embeddings.
 *
 * The candidate-selection step is now a Postgres RPC
 * (`next_unembedded_video_ids` — migration 0029) instead of two PostgREST
 * round-trips with client-side filtering. The earlier two-round-trip
 * approach kept overwriting the same 100 rows on every cron tick because:
 *   * pgvector NULL filtering through PostgREST was unreliable, and
 *   * even after migration 0028 added a plain timestamp flag, consecutive
 *     SELECTs occasionally missed rows that had just been upserted.
 *
 * The RPC computes the batch atomically against the latest committed state,
 * with the latest snapshot title pre-joined per video_id. Each cron run
 * therefore picks a disjoint batch and coverage grows by `embedded` rows
 * rather than churning in place.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { buildEmbeddingsBatch } from '@/lib/embeddings/build'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH_SIZE = 100

interface UnembeddedRow {
  video_id: string
  latest_title: string | null
}

function checkCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
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

  // Single atomic call: gets up to BATCH_SIZE unembedded video_ids, each
  // with the latest non-empty snapshot title pre-joined, ordered by
  // video_metrics.computed_at DESC. See migration 0029 for the SQL body.
  const { data: rpcData, error: rpcErr } = await supabase.rpc('next_unembedded_video_ids', {
    batch_size: BATCH_SIZE,
  })
  if (rpcErr) {
    console.error('[embeddings/build] next_unembedded_video_ids rpc failed', rpcErr)
    return Response.json({ error: 'rpc error', detail: rpcErr.message }, { status: 500 })
  }

  const rows = (rpcData ?? []) as UnembeddedRow[]
  const ids: string[] = []
  const titles: string[] = []
  let skippedNoTitle = 0
  for (const r of rows) {
    if (!r.latest_title || r.latest_title.trim().length === 0) {
      skippedNoTitle++
      continue
    }
    ids.push(r.video_id)
    titles.push(r.latest_title.trim())
  }

  console.log(
    '[embeddings/build] candidate stage',
    JSON.stringify({
      rpcRowsReturned: rows.length,
      idsToEmbed: ids.length,
      skippedNoTitle,
    }),
  )

  if (ids.length === 0) {
    return Response.json({
      processed: 0,
      embedded: 0,
      batch: BATCH_SIZE,
      reason: rows.length === 0 ? 'no_targets' : 'no_titles',
      skippedNoTitle,
    })
  }

  let vecs: number[][]
  try {
    vecs = await buildEmbeddingsBatch(titles)
  } catch (err) {
    console.error('[embeddings/build] OpenAI batch failed', err)
    return Response.json({ error: 'embedding failed' }, { status: 502 })
  }

  let embedded = 0
  const upsertErrors: Array<{ id: string; msg: string }> = []
  const now = new Date().toISOString()
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase
      .from('video_embeddings')
      .upsert(
        {
          video_id: ids[i],
          title_embedding: vecs[i],
          // title_embedded_at is the flag the RPC's NOT EXISTS subquery
          // uses to skip already-done videos on the next cron tick.
          title_embedded_at: now,
          embedded_at: now,
        },
        { onConflict: 'video_id' },
      )
    if (error) {
      console.error('[embeddings/build] upsert failed', ids[i], error)
      upsertErrors.push({ id: ids[i], msg: error.message ?? String(error) })
    } else {
      embedded++
    }
  }

  console.log(
    '[embeddings/build] done',
    JSON.stringify({
      processed: ids.length,
      embedded,
      upsertFailures: upsertErrors.length,
      upsertErrorSample: upsertErrors.slice(0, 3),
    }),
  )

  return Response.json({
    processed: ids.length,
    embedded,
    batch: BATCH_SIZE,
    upsertFailures: upsertErrors.length,
    skippedNoTitle,
  })
}
