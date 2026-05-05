/**
 * Exploding-videos discovery cron — Phase 5b primary growth signal.
 *
 * SurgeNiche's value prop is "small channel with a banger video", not
 * "what's trending globally". YouTube's videos.list?chart=mostPopular
 * surfaces ONLY huge channels (MrBeast-tier) because that's literally
 * what mostPopular means. Wrong tool for our use case.
 *
 * The right API: search.list with order=viewCount + publishedAfter=14d +
 * videoCategoryId. This returns videos in the last 14 days SORTED BY VIEW
 * COUNT, regardless of channel size. We then hydrate the unique channels
 * and filter by subscriber band (1k-500k). The combination surfaces
 * small/mid-size channels whose recent video racked up an outsized number
 * of views — the literal definition of "exploding" in SurgeNiche terms.
 *
 * Quota cost per run:
 *   8 search.list calls × 100 units = 800 units (the expensive part)
 *   ~30-60 channels.list batches × 1 unit ≈ 30-60 units
 *   Total: ~830-860 units/day. Safe under 10000-unit/day budget.
 *
 * Schedule: 1×/day at 02:00 UTC (vercel.json).
 *
 * Why pay 100×-quota for search.list over mostPopular? Because mostPopular
 * never returns the small channels we exist to surface. A 1k-sub channel
 * with a 100k-view banger never lands on YouTube's mostPopular chart;
 * search.list+order=viewCount+publishedAfter does surface it.
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

// YouTube videoCategoryId list. These are YouTube's NATIVE category IDs
// (not ours) — we use them as a coarse pre-filter for search.list. The
// actual category_enum is assigned per-channel by Claude classifier.
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
const PUBLISHED_AFTER_DAYS = 14

// Channel size band — SurgeNiche's whole point is "small channel with a
// banger video". A 1k-sub channel with 100k views is the gold; a 5M-sub
// channel doing 100k is normal noise. The 500k upper bound matches the
// existing discover edge function's longform threshold.
//
// search.list+order=viewCount surfaces high-view-count videos regardless
// of channel size, then we filter at hydrate time. The intersection
// (high views AND small channel) is precisely the breakout signal.
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

/**
 * Fetch the highest-view-count videos uploaded in the last
 * PUBLISHED_AFTER_DAYS days for a given videoCategoryId.
 *
 * search.list with order=viewCount returns videos sorted by total view
 * count regardless of channel size or upload time within the window. A
 * recent video that racked up a lot of views floats to the top — exactly
 * the breakout signal we want to convert into channel-discovery seeds.
 *
 * Quota: 100 units per call. Worth it because mostPopular (1 unit) returns
 * ONLY the YouTube-curated trending list which is dominated by huge
 * channels we don't want.
 */
async function fetchExplodingForCategory(
  apiKey: string,
  videoCategoryId: string,
): Promise<ExplodingVideo[]> {
  const publishedAfterIso = new Date(
    Date.now() - PUBLISHED_AFTER_DAYS * 86400 * 1000,
  ).toISOString()
  const url = new URL(`${YT_BASE}/search`)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('type', 'video')
  url.searchParams.set('order', 'viewCount')
  url.searchParams.set('publishedAfter', publishedAfterIso)
  url.searchParams.set('videoCategoryId', videoCategoryId)
  url.searchParams.set('regionCode', REGION_CODE)
  url.searchParams.set('relevanceLanguage', 'en')
  url.searchParams.set('maxResults', String(MAX_RESULTS_PER_CATEGORY))

  const res = await fetch(url.toString())
  if (!res.ok) {
    const body = await res.text()
    throw new Error(
      `search.list failed (cat ${videoCategoryId}): ${res.status} ${body.slice(0, 200)}`,
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
  // in multiple categories' top-viewed videos should be hydrated + inserted
  // once.
  const seenChannelIdsThisRun = new Set<string>()
  // Carry per-channel "first sighting title" for classifier context.
  const channelFirstVideo = new Map<string, ExplodingVideo>()

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
      const videos = await fetchExplodingForCategory(apiKey, cat.id)
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

        // search.list doesn't return video duration cheaply. Default to
        // longform — the scan pipeline will pick up shorts on a per-video
        // basis when it ingests this channel's recent uploads, and a wrong
        // content_type tag just means we ingest a slightly smaller subset.
        const result = await insertCandidateChannel(supabase, {
          youtubeChannelId: ch.channelId,
          channelName: ch.title,
          category,
          contentType: 'longform',
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
