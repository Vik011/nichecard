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
import { checkCronSecret } from '@/lib/discovery/channelOnboard'
import * as Sentry from '@sentry/nextjs'

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

interface BatchOutcome {
  rpcRows: number
  candidates: number
  skippedNoTitle: number
  embedded: number
  upsertFailures: number
  // video_ids the route just attempted to upsert. The outer loop accumulates
  // these and passes them as the exclude list on the next RPC call so the
  // function never re-returns them, even if the PostgREST pool connection
  // hasn't picked up our flag write yet.
  processedVideoIds: string[]
}

async function processOneBatch(
  supabase: ReturnType<typeof createServiceClient>,
  excludeIds: string[],
): Promise<BatchOutcome | 'empty'> {
  const t0 = Date.now()
  const { data: rpcData, error: rpcErr } = await supabase.rpc('next_unembedded_video_ids', {
    batch_size: BATCH_SIZE,
    exclude_ids: excludeIds,
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
      processedVideoIds: rows.map((r) => r.video_id),
    }
  }

  const tRpc = Date.now() - t0
  const vecs = await buildEmbeddingsBatch(titles)
  const tEmbed = Date.now() - t0 - tRpc

  // Single bulk upsert — one SQL statement for all rows in the batch.
  // Earlier we did 100 sequential upserts per batch, which alone consumed
  // 30-40s and pushed the per-invocation budget over Vercel's 60s
  // timeout. Bulk-upserting collapses that to ~1 round-trip.
  const now = new Date().toISOString()
  const upsertRows = ids.map((id, i) => ({
    video_id: id,
    title_embedding: vecs[i],
    title_embedded_at: now,
    embedded_at: now,
  }))
  const { error: upsertErr } = await supabase
    .from('video_embeddings')
    .upsert(upsertRows, { onConflict: 'video_id' })

  let embedded = 0
  let upsertFailures = 0
  if (upsertErr) {
    console.error(
      '[embeddings/build] bulk upsert failed',
      JSON.stringify({ batchIds: ids.length, msg: upsertErr.message }),
    )
    upsertFailures = ids.length
  } else {
    embedded = ids.length
  }

  const tUpsert = Date.now() - t0 - tRpc - tEmbed
  console.log(
    '[embeddings/build] batch',
    JSON.stringify({
      ids: ids.length,
      tRpcMs: tRpc,
      tEmbedMs: tEmbed,
      tUpsertMs: tUpsert,
      tTotalMs: Date.now() - t0,
      embedded,
      upsertFailures,
    }),
  )

  return {
    rpcRows: rows.length,
    candidates: ids.length,
    skippedNoTitle,
    embedded,
    upsertFailures,
    processedVideoIds: ids,
  }
}

export async function GET(request: Request) {
  if (!checkCronSecret(request)) {
    return new Response('unauthorized', { status: 401 })
  }
  try {

  const supabase = createServiceClient()
  const startedAt = Date.now()

  let batchesRun = 0
  let totalRpcRows = 0
  let totalCandidates = 0
  let totalSkippedNoTitle = 0
  let totalEmbedded = 0
  let totalUpsertFailures = 0
  let stopReason: 'queue_empty' | 'max_batches' | 'time_budget' | 'error' = 'queue_empty'
  // Accumulate processed video_ids so each iteration's RPC call excludes
  // them explicitly. Diagnostic showed PostgREST pool connections don't
  // reliably see prior-call upserts within the same Vercel invocation, so
  // we cannot rely on title_embedded_at IS NOT NULL alone to gate batches.
  const processedIds: string[] = []

  try {
    for (let i = 0; i < MAX_BATCHES_PER_INVOCATION; i++) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        stopReason = 'time_budget'
        break
      }
      const result = await processOneBatch(supabase, processedIds)
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
      processedIds.push(...result.processedVideoIds)

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
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: 'embeddings/build' } })
    console.error('[embeddings/build] uncaught error', err)
    return new Response('internal error', { status: 500 })
  }
}
