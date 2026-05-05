/**
 * Cron route: pull videos lacking title_embedding, embed via OpenAI in one
 * batch, UPSERT video_embeddings.
 *
 * BATCH_SIZE = 100. Titles are ~100 chars each so this fits well under the
 * 50-input safety cap of buildEmbeddingsBatch — but the helper splits
 * automatically so we pass all 100 and let it do 2 OpenAI calls.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { buildEmbeddingsBatch } from '@/lib/embeddings/build'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH_SIZE = 100

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

  // Find video_ids that already have a title_embedding. We filter on the
  // plain timestamp column `title_embedded_at` (added in migration 0028)
  // rather than the vector column directly: PostgREST's NULL handling for
  // pgvector is unreliable, which previously caused haveTitle to be empty
  // even after rows were genuinely embedded — the route then re-picked the
  // same top-100 candidates every run and the UPSERT just overwrote them
  // in place, freezing coverage.
  const { data: existing, error: existErr } = await supabase
    .from('video_embeddings')
    .select('video_id')
    .not('title_embedded_at', 'is', null)
    .limit(10_000)
  if (existErr) {
    console.error('[embeddings/build] list video_embeddings failed', existErr)
    return Response.json({ error: 'db error' }, { status: 500 })
  }
  const haveTitle = new Set((existing ?? []).map((r) => r.video_id as string))

  // Pull a wider candidate window than 5×BATCH_SIZE — a row's `computed_at`
  // can drop out of the top 500 once we have many video_metrics rows, so we
  // give ourselves room. Bumped to 50× so even a 5k pool still surfaces.
  const { data: candidates, error: candErr } = await supabase
    .from('video_metrics')
    .select('video_id, computed_at')
    .order('computed_at', { ascending: false, nullsFirst: false })
    .limit(BATCH_SIZE * 50)
  if (candErr) {
    console.error('[embeddings/build] list video_metrics failed', candErr)
    return Response.json({ error: 'db error' }, { status: 500 })
  }

  const targetIds = (candidates ?? [])
    .filter((c) => !haveTitle.has(c.video_id as string))
    .slice(0, BATCH_SIZE)
    .map((c) => c.video_id as string)

  console.log(
    '[embeddings/build] candidate stage',
    JSON.stringify({
      embeddingsRowsTotal: existing?.length ?? 0,
      haveTitleCount: haveTitle.size,
      candidatesPulled: candidates?.length ?? 0,
      targetIdsLength: targetIds.length,
    }),
  )

  if (targetIds.length === 0) {
    return Response.json({ processed: 0, embedded: 0, batch: BATCH_SIZE, reason: 'no_targets' })
  }

  // Bulk-fetch the latest snapshot title per video.
  // Column is `scanned_at` per migration 0024 schema (NOT `captured_at` —
  // that was a stale copy-paste from a different table that silently 500'd
  // every cron run, leaving embedding coverage at 0%).
  //
  // PostgREST default row cap is 1000. With ~20 snapshots per video over the
  // 60-day retention window, 100 video_ids can balloon to 2k rows — the
  // truncated half could omit some video_ids entirely. Explicit higher cap
  // pulls everything we need in one go.
  const { data: snaps, error: snapErr } = await supabase
    .from('video_snapshots')
    .select('video_id, title, scanned_at')
    .in('video_id', targetIds)
    .order('scanned_at', { ascending: false })
    .limit(50_000)
  if (snapErr) {
    console.error('[embeddings/build] list video_snapshots failed', snapErr)
    return Response.json({ error: 'db error' }, { status: 500 })
  }

  // Pick latest snapshot title per video_id (sorted desc → first wins)
  const latestTitle = new Map<string, string>()
  for (const s of snaps ?? []) {
    const vid = s.video_id as string
    if (latestTitle.has(vid)) continue
    const title = (s.title as string | null)?.trim()
    if (title) latestTitle.set(vid, title)
  }

  const ids: string[] = []
  const titles: string[] = []
  const skippedNoTitle: string[] = []
  for (const id of targetIds) {
    const t = latestTitle.get(id)
    if (!t) {
      skippedNoTitle.push(id)
      continue
    }
    ids.push(id)
    titles.push(t)
  }

  console.log(
    '[embeddings/build] snapshot stage',
    JSON.stringify({
      snapsReturned: snaps?.length ?? 0,
      latestTitleMapSize: latestTitle.size,
      idsToEmbed: ids.length,
      skippedNoTitleCount: skippedNoTitle.length,
      skippedNoTitleSample: skippedNoTitle.slice(0, 3),
    }),
  )

  if (ids.length === 0) {
    return Response.json({ processed: 0, embedded: 0, batch: BATCH_SIZE, reason: 'no_titles' })
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
          // title_embedded_at is the flag the route uses on the next cron
          // tick to know "this video already has a title vector", so we set
          // it together with the vector itself.
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
  })
}
