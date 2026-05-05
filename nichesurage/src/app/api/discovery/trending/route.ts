/**
 * Exploding-videos discovery cron — Phase 5b primary growth signal.
 *
 * SurgeNiche's value prop is "small channel with a banger video", not
 * "what's trending globally". The right primitive is YouTube `search.list`
 * with `order=viewCount + publishedAfter` driven by curated KEYWORD seeds.
 *
 * Why keyword seeds and not videoCategoryId? videoCategoryId without a
 * `q` returns 0 results in practice — verified empirically (production
 * smoke test 2026-05-05 returned trendingVideos=0 across 7 categories).
 * The existing /supabase/functions/discover Deno function — which has been
 * adding channels to channels_watchlist for weeks — uses `q=<keyword>`
 * with order=viewCount + publishedAfter and that pattern works. We mirror
 * it here on Vercel-Node so the cron can run more frequently than the
 * Supabase pg_cron daily Edge Function tick.
 *
 * Seeds come from the seed_keywords table (already curated per Sprint A.8;
 * see migration 0022). Each cron run picks the top N highest-priority
 * active longform EN seeds. The KEYWORD itself targets known small-channel-
 * rich niches: "AI Automation Agency", "Dark History of", "Costco Deals
 * You NEED To Buy", etc. Those phrases match titles small creators write
 * imitating successful larger creators in the same niche, surfacing the
 * imitator small channels that may be quietly exploding.
 *
 * Quota cost per run:
 *   N seeds × 100 units (search.list) + ~hydrate batches × 1 unit
 *   With N=12 seeds: 1200 + ~50 ≈ 1250 units/day. Safe under 10k budget.
 *
 * Schedule: 1×/day at 02:00 UTC (vercel.json).
 */

import { createServiceClient } from '@/lib/supabase/service'
import {
  hydrateChannels,
  classifyChannelCategory,
  insertCandidateChannel,
  filterNewChannelIds,
  checkCronSecret,
  getYouTubeApiKey,
} from '@/lib/discovery/channelOnboard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const YT_BASE = 'https://www.googleapis.com/youtube/v3'
const REGION_CODE = 'US'
const MAX_RESULTS_PER_SEED = 50
const PUBLISHED_AFTER_DAYS = 14
const SEEDS_PER_RUN = 12

// Channel size band — SurgeNiche surfaces small channels with breakout
// videos. 1k floor filters spam; 500k cap matches the existing longform
// /discover function. Top viewed videos under a niche-specific keyword
// often come from small channels imitating larger creators in the same
// niche, so the intersection (high views AND small channel) materialises.
const MIN_SUBS = 1_000
const MAX_SUBS = 500_000

interface ExplodingVideo {
  videoId: string
  channelId: string
  title: string
}

interface SearchListResponse {
  items?: Array<{
    id?: { videoId?: string }
    snippet?: { channelId?: string; title?: string }
  }>
}

interface SeedKeywordRow {
  term: string
  priority: number
}

/**
 * Fetch the top N active longform EN seed keywords from the canonical
 * seed_keywords table. These were curated in Sprint A.8 (migration 0022)
 * to target known small-channel-rich niches.
 */
async function fetchActiveSeeds(
  supabase: ReturnType<typeof createServiceClient>,
  limit: number,
): Promise<SeedKeywordRow[]> {
  const { data, error } = await supabase
    .from('seed_keywords')
    .select('term, priority')
    .eq('is_active', true)
    .eq('language', 'en')
    .eq('content_type', 'longform')
    .order('priority', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[discovery/trending] seed fetch failed', error.message)
    return []
  }
  return (data ?? []) as SeedKeywordRow[]
}

/**
 * Run YouTube search.list with `q=<seed>`, `order=viewCount`,
 * `publishedAfter=14d`. Returns the highest-view-count videos for that
 * keyword in the recency window — small or large channel alike. Channel
 * size filtering happens downstream at hydration.
 */
async function fetchExplodingForSeed(
  apiKey: string,
  seed: string,
): Promise<ExplodingVideo[]> {
  const publishedAfterIso = new Date(
    Date.now() - PUBLISHED_AFTER_DAYS * 86400 * 1000,
  ).toISOString()
  const url = new URL(`${YT_BASE}/search`)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('type', 'video')
  url.searchParams.set('q', seed)
  url.searchParams.set('order', 'viewCount')
  url.searchParams.set('publishedAfter', publishedAfterIso)
  url.searchParams.set('regionCode', REGION_CODE)
  url.searchParams.set('relevanceLanguage', 'en')
  url.searchParams.set('maxResults', String(MAX_RESULTS_PER_SEED))

  const res = await fetch(url.toString())
  if (!res.ok) {
    const body = await res.text()
    throw new Error(
      `search.list failed (seed "${seed}"): ${res.status} ${body.slice(0, 200)}`,
    )
  }
  const json = (await res.json()) as SearchListResponse
  const out: ExplodingVideo[] = []
  for (const item of json.items ?? []) {
    const videoId = item.id?.videoId
    const channelId = item.snippet?.channelId
    if (!videoId || !channelId) continue
    out.push({
      videoId,
      channelId,
      title: item.snippet?.title ?? '',
    })
  }
  return out
}

interface SeedOutcome {
  seed: string
  priority: number
  videosReturned: number
  distinctChannels: number
  newChannels: number
  hydrationFailed: number
  outOfBand: number
  inserted: number
  classifyFailures: number
}

export async function GET(request: Request) {
  if (!checkCronSecret(request)) {
    return new Response('unauthorized', { status: 401 })
  }

  let apiKey: string
  try {
    apiKey = getYouTubeApiKey()
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : 'config error' },
      { status: 500 },
    )
  }

  const supabase = createServiceClient()
  const startedAt = Date.now()
  const outcomes: SeedOutcome[] = []

  const seeds = await fetchActiveSeeds(supabase, SEEDS_PER_RUN)
  if (seeds.length === 0) {
    return Response.json({
      ok: true,
      reason: 'no_seeds_in_db',
      totalInserted: 0,
      totalSeen: 0,
      elapsedMs: Date.now() - startedAt,
      outcomes: [],
    })
  }

  // Single in-memory dedup set across seeds — same channel showing up in
  // multiple keyword results should be hydrated + inserted once.
  const seenChannelIdsThisRun = new Set<string>()
  const channelFirstVideo = new Map<string, ExplodingVideo>()

  for (const seedRow of seeds) {
    const outcome: SeedOutcome = {
      seed: seedRow.term,
      priority: seedRow.priority,
      videosReturned: 0,
      distinctChannels: 0,
      newChannels: 0,
      hydrationFailed: 0,
      outOfBand: 0,
      inserted: 0,
      classifyFailures: 0,
    }
    try {
      const videos = await fetchExplodingForSeed(apiKey, seedRow.term)
      outcome.videosReturned = videos.length

      const distinct = new Set<string>()
      for (const v of videos) {
        if (!seenChannelIdsThisRun.has(v.channelId)) {
          distinct.add(v.channelId)
          seenChannelIdsThisRun.add(v.channelId)
          channelFirstVideo.set(v.channelId, v)
        }
      }
      outcome.distinctChannels = distinct.size
      if (distinct.size === 0) {
        outcomes.push(outcome)
        continue
      }

      const newIds = await filterNewChannelIds(supabase, Array.from(distinct))
      outcome.newChannels = newIds.length
      if (newIds.length === 0) {
        outcomes.push(outcome)
        continue
      }

      const hydrated = await hydrateChannels(apiKey, newIds)
      outcome.hydrationFailed = newIds.length - hydrated.length

      for (const ch of hydrated) {
        if (ch.subscriberCount < MIN_SUBS || ch.subscriberCount > MAX_SUBS) {
          outcome.outOfBand++
          continue
        }
        if (!ch.title || ch.title.length === 0) {
          outcome.outOfBand++
          continue
        }

        const firstVid = channelFirstVideo.get(ch.channelId)
        const sampleTitles = firstVid?.title ? [firstVid.title] : []

        let category
        try {
          category = await classifyChannelCategory(
            ch.title,
            ch.description,
            sampleTitles,
          )
        } catch (err) {
          outcome.classifyFailures++
          console.error(
            '[discovery/trending] classify error',
            ch.channelId,
            err instanceof Error ? err.message : err,
          )
          continue
        }

        const result = await insertCandidateChannel(supabase, {
          youtubeChannelId: ch.channelId,
          channelName: ch.title,
          category,
          contentType: 'longform',
          language: 'en',
          discoveredVia: 'trending_feed',
          nicheLabel: seedRow.term,
        })
        if (result === 'inserted') outcome.inserted++
      }
    } catch (err) {
      console.error(
        '[discovery/trending] seed failed',
        seedRow.term,
        err instanceof Error ? err.message : err,
      )
    }
    outcomes.push(outcome)
  }

  const elapsedMs = Date.now() - startedAt
  const totalInserted = outcomes.reduce((s, o) => s + o.inserted, 0)
  const totalSeen = outcomes.reduce((s, o) => s + o.distinctChannels, 0)

  console.log(
    '[discovery/trending] done',
    JSON.stringify({ totalInserted, totalSeen, elapsedMs, outcomes }),
  )

  return Response.json({
    ok: true,
    totalInserted,
    totalSeen,
    elapsedMs,
    outcomes,
  })
}
