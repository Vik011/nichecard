/**
 * Cron route: pull videos lacking a phash row, fetch latest snapshot
 * thumbnail_url, compute pHash, UPSERT video_thumbnail_phash.
 *
 * BATCH_SIZE = 50. Sequential fetches with a 100ms delay each so we don't
 * hammer the ytimg CDN. Worst case 50 * (5s timeout + 0.1s) = ~5 min, but
 * typical thumbnail fetches are <500ms and we're well under maxDuration.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { computePHash } from '@/lib/thumbnails/phash'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH_SIZE = 50
const SLEEP_BETWEEN_MS = 100

function checkCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const got =
    request.headers.get('x-cron-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    null
  return got === secret
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function GET(request: Request) {
  if (!checkCronSecret(request)) {
    return new Response('unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: existing, error: existErr } = await supabase
    .from('video_thumbnail_phash')
    .select('video_id')
    .limit(10_000)
  if (existErr) {
    console.error('[thumbnails/phash] list phash failed', existErr)
    return Response.json({ error: 'db error' }, { status: 500 })
  }
  const seen = new Set((existing ?? []).map((r) => r.video_id as string))

  const { data: candidates, error: candErr } = await supabase
    .from('video_metrics')
    .select('video_id, computed_at')
    .order('computed_at', { ascending: false })
    .limit(BATCH_SIZE * 5)
  if (candErr) {
    console.error('[thumbnails/phash] list video_metrics failed', candErr)
    return Response.json({ error: 'db error' }, { status: 500 })
  }

  const targetIds = (candidates ?? [])
    .filter((c) => !seen.has(c.video_id as string))
    .slice(0, BATCH_SIZE)
    .map((c) => c.video_id as string)

  if (targetIds.length === 0) {
    return Response.json({ processed: 0, hashed: 0, skipped: 0, batch: BATCH_SIZE })
  }

  // Column is `scanned_at` per migration 0024 schema (NOT `captured_at`).
  const { data: snaps, error: snapErr } = await supabase
    .from('video_snapshots')
    .select('video_id, thumbnail_url, scanned_at')
    .in('video_id', targetIds)
    .order('scanned_at', { ascending: false })
  if (snapErr) {
    console.error('[thumbnails/phash] list snapshots failed', snapErr)
    return Response.json({ error: 'db error' }, { status: 500 })
  }

  const latestThumb = new Map<string, string>()
  for (const s of snaps ?? []) {
    const vid = s.video_id as string
    if (latestThumb.has(vid)) continue
    const url = (s.thumbnail_url as string | null)?.trim()
    if (url) latestThumb.set(vid, url)
  }

  let processed = 0
  let hashed = 0
  let skipped = 0

  for (const id of targetIds) {
    const url = latestThumb.get(id)
    if (!url) {
      skipped++
      continue
    }
    processed++
    const h = await computePHash(url)
    if (h == null) {
      // Tombstone with phash = 0 would be ambiguous; instead skip this round
      // and let the next cron retry. Thumbnail fetch failures are usually
      // transient (CDN edge hiccup).
      skipped++
      await sleep(SLEEP_BETWEEN_MS)
      continue
    }
    // Postgres bigint is signed 64-bit. Our hash can have the top bit set,
    // which would overflow. Store as a string — Supabase JS will pass it
    // through; the column should be `bigint` (Postgres handles up to 2^63-1
    // unsigned via the bigint type's representation). To be safe across
    // values with the top bit set, we cast to signed: subtract 2^64 if too
    // large.
    const TWO63 = BigInt(1) << BigInt(63)
    const TWO64 = BigInt(1) << BigInt(64)
    const signed = h >= TWO63 ? h - TWO64 : h
    // Column is `hashed_at` per migration 0024 schema (NOT `computed_at`).
    const { error } = await supabase
      .from('video_thumbnail_phash')
      .upsert(
        {
          video_id: id,
          phash: signed.toString(),
          hashed_at: new Date().toISOString(),
        },
        { onConflict: 'video_id' },
      )
    if (error) {
      console.error('[thumbnails/phash] upsert failed', id, error)
    } else {
      hashed++
    }
    await sleep(SLEEP_BETWEEN_MS)
  }

  return Response.json({ processed, hashed, skipped, batch: BATCH_SIZE })
}
