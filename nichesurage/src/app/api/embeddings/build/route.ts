/**
 * Cron route: drain the title-embedding queue until empty or near the
 * Vercel maxDuration budget.
 *
 * Each iteration of the inner loop calls `next_unembedded_video_ids`
 * (migration 0029) to atomically grab up to BATCH_SIZE candidates, then
 * embeds + upserts. Looping inside ONE invocation side-steps a multi-
 * invocation coordination problem we hit earlier: consecutive Run-now
 * clicks (or rapid scheduled cron firings) sometimes returned overlapping
 * candidate sets across separate function executions, so coverage grew
 * fractionally per click instead of fully. Within a single function
 * execution the RPC sees its own previous upserts on each call, so each
 * batch is genuinely disjoint and the queue drains cleanly.
 *
 * Budget shape: ~3s OpenAI per batch + ~5s for 100 sequential upserts =
 * ~8s per batch. With Vercel maxDuration 60s and a 10s safety margin we
 * allow up to MAX_BATCHES_PER_INVOCATION = 6, i.e. up to 600 embeddings
 * per Run-now or scheduled tick.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { buildEmbeddingsBatch } from '@/lib/embeddings/build'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH_SIZE = 100
const MAX_BATCHES_PER_INVOCATION = 6
const TIME_BUDGET_MS = 50_000 // leave 10s headroom under maxDuration

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

interface BatchOutcome {
  rpcRows: number
  candidates: number
  skippedNoTitle: number
  embedded: number
  upsertFailures: number
}

async function processOneBatch(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<BatchOutcome | 'empty'> {
  const { data: rpcData, error: rpcErr } = await supabase.rpc('next_unembedded_video_ids', {
    batch_size: BATCH_SIZE,
  })
  if (rpcErr) {
    console.error('[embeddings/build] rpc failed', rpcErr)
    throw new Error(`rpc: ${rpcErr.message}`)
  }
  const rows = (rpcData ?? []) as UnembeddedRow[]
  if (rows.length === 0) return 'empty'

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

  if (ids.length === 0) {
    return {
      rpcRows: rows.length,
      candidates: 0,
      skippedNoTitle,
      embedded: 0,
      upsertFailures: 0,
    }
  }

  const vecs = await buildEmbeddingsBatch(titles)

  let embedded = 0
  let upsertFailures = 0
  const now = new Date().toISOString()
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase
      .from('video_embeddings')
      .upsert(
        {
          video_id: ids[i],
          title_embedding: vecs[i],
          // title_embedded_at gates next iteration's RPC subquery.
          title_embedded_at: now,
          embedded_at: now,
        },
        { onConflict: 'video_id' },
      )
    if (error) {
      console.error('[embeddings/build] upsert failed', ids[i], error.message)
      upsertFailures++
    } else {
      embedded++
    }
  }

  return {
    rpcRows: rows.length,
    candidates: ids.length,
    skippedNoTitle,
    embedded,
    upsertFailures,
  }
}

export async function GET(request: Request) {
  if (!checkCronSecret(request)) {
    return new Response('unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()
  const startedAt = Date.now()

  let batchesRun = 0
  let totalRpcRows = 0
  let totalCandidates = 0
  let totalSkippedNoTitle = 0
  let totalEmbedded = 0
  let totalUpsertFailures = 0
  let stopReason: 'queue_empty' | 'max_batches' | 'time_budget' | 'error' = 'queue_empty'

  try {
    for (let i = 0; i < MAX_BATCHES_PER_INVOCATION; i++) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        stopReason = 'time_budget'
        break
      }
      const result = await processOneBatch(supabase)
      if (result === 'empty') {
        stopReason = 'queue_empty'
        break
      }
      batchesRun++
      totalRpcRows += result.rpcRows
      totalCandidates += result.candidates
      totalSkippedNoTitle += result.skippedNoTitle
      totalEmbedded += result.embedded
      totalUpsertFailures += result.upsertFailures

      if (i === MAX_BATCHES_PER_INVOCATION - 1) {
        stopReason = 'max_batches'
      }
    }
  } catch (err) {
    stopReason = 'error'
    console.error('[embeddings/build] aborting batch loop', err)
  }

  const elapsedMs = Date.now() - startedAt
  console.log(
    '[embeddings/build] done',
    JSON.stringify({
      batchesRun,
      totalRpcRows,
      totalCandidates,
      totalSkippedNoTitle,
      totalEmbedded,
      totalUpsertFailures,
      stopReason,
      elapsedMs,
    }),
  )

  return Response.json({
    batchesRun,
    totalEmbedded,
    totalSkippedNoTitle,
    totalUpsertFailures,
    stopReason,
    elapsedMs,
    batchSize: BATCH_SIZE,
  })
}
