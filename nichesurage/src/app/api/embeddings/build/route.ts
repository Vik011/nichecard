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

  // Find video_ids where title_embedding IS NULL (or row missing entirely).
  const { data: existing, error: existErr } = await supabase
    .from('video_embeddings')
    .select('video_id, title_embedding')
    .limit(10_000)
  if (existErr) {
    console.error('[embeddings/build] list video_embeddings failed', existErr)
    return Response.json({ error: 'db error' }, { status: 500 })
  }
  const haveTitle = new Set(
    (existing ?? [])
      .filter((r) => r.title_embedding !== null && r.title_embedding !== undefined)
      .map((r) => r.video_id as string),
  )

  const { data: candidates, error: candErr } = await supabase
    .from('video_metrics')
    .select('video_id, computed_at')
    .order('computed_at', { ascending: false })
    .limit(BATCH_SIZE * 5)
  if (candErr) {
    console.error('[embeddings/build] list video_metrics failed', candErr)
    return Response.json({ error: 'db error' }, { status: 500 })
  }

  const targetIds = (candidates ?? [])
    .filter((c) => !haveTitle.has(c.video_id as string))
    .slice(0, BATCH_SIZE)
    .map((c) => c.video_id as string)

  if (targetIds.length === 0) {
    return Response.json({ processed: 0, embedded: 0, batch: BATCH_SIZE })
  }

  // Bulk-fetch the latest snapshot title per video.
  const { data: snaps, error: snapErr } = await supabase
    .from('video_snapshots')
    .select('video_id, title, captured_at')
    .in('video_id', targetIds)
    .order('captured_at', { ascending: false })
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
  for (const id of targetIds) {
    const t = latestTitle.get(id)
    if (!t) continue // No usable snapshot title yet — skip this round
    ids.push(id)
    titles.push(t)
  }

  if (ids.length === 0) {
    return Response.json({ processed: 0, embedded: 0, batch: BATCH_SIZE })
  }

  let vecs: number[][]
  try {
    vecs = await buildEmbeddingsBatch(titles)
  } catch (err) {
    console.error('[embeddings/build] OpenAI batch failed', err)
    return Response.json({ error: 'embedding failed' }, { status: 502 })
  }

  let embedded = 0
  const now = new Date().toISOString()
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase
      .from('video_embeddings')
      .upsert(
        { video_id: ids[i], title_embedding: vecs[i], embedded_at: now },
        { onConflict: 'video_id' },
      )
    if (error) {
      console.error('[embeddings/build] upsert failed', ids[i], error)
    } else {
      embedded++
    }
  }

  return Response.json({ processed: ids.length, embedded, batch: BATCH_SIZE })
}
