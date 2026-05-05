/**
 * Trending discovery cron — Phase 5b primary growth signal.
 *
 * Reads YouTube's officially curated trending feed via
 *   videos.list?chart=mostPopular&regionCode=US&videoCategoryId=X
 *
 * For 8 broad YouTube videoCategoryIds that map to our 12 industry
 * categories, fetch up to 50 trending videos per category, extract distinct
 * channelIds, hydrate channel stats, classify into our taxonomy via Claude
 * Haiku, and INSERT new channels into channels_watchlist as Tier 1
 * (candidate) rows. Existing channels are skipped.
 *
 * Quota cost per run:
 *   8 mostPopular calls × 1 unit = 8 units
 *   ~30-60 channels.list batches × 1 unit ≈ 30-60 units
 *   Total: ~40-70 units/day. Safe under 10000-unit/day budget.
 *
 * Schedule: 1×/day at 02:00 UTC (vercel.json).
 *
 * Why videos.list mostPopular and not search.list keyword? mostPopular is
 * 1 quota unit per call vs 100 for search.list — 100× cheaper for an
 * arguably better signal (YouTube's own trending curation is broad and
 * covers many channels we'd never reach via keyword seeds).
 */

import { createServiceClient } from '@/lib/supabase/service'
import {
  hydrateChannels,
  classifyChannelCategory,
  insertCandidateChannel,
  filterNewChannelIds,
  inferContentType,
  checkCronSecret,
  getYouTubeApiKey,
} from '@/lib/discovery/channelOnboard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// YouTube videoCategoryId list mapping to our 12-niche taxonomy. We hit
// the broad 8 that produce the highest-signal trending feeds. Note these
// are YouTube's NATIVE categories (not ours) — the actual category_enum
// is assigned per-channel by Claude classifier downstream.
//   20 = Gaming
//   22 = People & Blogs
//   23 = Comedy
//   24 = Entertainment
//   25 = News & Politics
//   26 = Howto & Style
//   27 = Education
//   28 = Science & Technology
const YT_TRENDING_CATEGORY_IDS: { id: string; label: string }[] = [
  { id: '20', label: 'Gaming' },
  { id: '22', label: 'People & Blogs' },
  { id: '23', label: 'Comedy' },
  { id: '24', label: 'Entertainment' },
  { id: '25', label: 'News & Politics' },
  { id: '26', label: 'Howto & Style' },
  { id: '27', label: 'Education' },
  { id: '28', label: 'Science & Technology' },
]

const YT_BASE = 'https://www.googleapis.com/youtube/v3'
const REGION_CODE = 'US'
const MAX_RESULTS_PER_CATEGORY = 50

// Channel size band — match the existing discover edge function so the
// trend engine's filtering and downstream scan logic stay consistent.
const MIN_SUBS = 1_000
const MAX_SUBS = 1_500_000

interface TrendingVideo {
  videoId: string
  channelId: string
  title: string
  durationSeconds: number
}

interface VideosListResponse {
  items?: Array<{
    id: string
    snippet?: { channelId?: string; title?: string }
    contentDetails?: { duration?: string }
  }>
}

function parseIsoDuration(s: string | undefined | null): number {
  if (!s) return 0
  const m = s.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!m) return 0
  const [, h, mi, se] = m
  return parseInt(h ?? '0') * 3600 + parseInt(mi ?? '0') * 60 + parseInt(se ?? '0')
}

async function fetchTrendingForCategory(
  apiKey: string,
  videoCategoryId: string,
): Promise<TrendingVideo[]> {
  const url = new URL(`${YT_BASE}/videos`)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('part', 'snippet,contentDetails')
  url.searchParams.set('chart', 'mostPopular')
  url.searchParams.set('regionCode', REGION_CODE)
  url.searchParams.set('videoCategoryId', videoCategoryId)
  url.searchParams.set('maxResults', String(MAX_RESULTS_PER_CATEGORY))

  const res = await fetch(url.toString())
  if (!res.ok) {
    const body = await res.text()
    throw new Error(
      `videos.list mostPopular failed (cat ${videoCategoryId}): ${res.status} ${body.slice(0, 200)}`,
    )
  }
  const json = (await res.json()) as VideosListResponse
  const out: TrendingVideo[] = []
  for (const item of json.items ?? []) {
    if (!item.id || !item.snippet?.channelId) continue
    out.push({
      videoId: item.id,
      channelId: item.snippet.channelId,
      title: item.snippet.title ?? '',
      durationSeconds: parseIsoDuration(item.contentDetails?.duration),
    })
  }
  return out
}

interface CategoryOutcome {
  categoryLabel: string
  trendingVideos: number
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
  const outcomes: CategoryOutcome[] = []

  // Single in-memory dedup set across categories — same channel showing up
  // in multiple trending categories should be hydrated + inserted once.
  const seenChannelIdsThisRun = new Set<string>()
  // Carry per-channel "first sighting title" for content_type inference.
  const channelFirstVideo = new Map<string, TrendingVideo>()

  for (const cat of YT_TRENDING_CATEGORY_IDS) {
    const outcome: CategoryOutcome = {
      categoryLabel: cat.label,
      trendingVideos: 0,
      distinctChannels: 0,
      newChannels: 0,
      hydrationFailed: 0,
      outOfBand: 0,
      inserted: 0,
      classifyFailures: 0,
    }
    try {
      const videos = await fetchTrendingForCategory(apiKey, cat.id)
      outcome.trendingVideos = videos.length

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
        // Reject obvious size-band misses early to save Claude calls.
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

        const contentType = inferContentType(
          firstVid ? [firstVid.durationSeconds] : [],
        )

        const result = await insertCandidateChannel(supabase, {
          youtubeChannelId: ch.channelId,
          channelName: ch.title,
          category,
          contentType,
          language: 'en',
          discoveredVia: 'trending_feed',
          nicheLabel: cat.label,
        })
        if (result === 'inserted') outcome.inserted++
      }
    } catch (err) {
      console.error(
        '[discovery/trending] category failed',
        cat.label,
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
