/**
 * Expand discovery cron — Phase 5b secondary growth signal via yt-dlp.
 *
 * The trending route (mostPopular) catches the broad pulse of YouTube's
 * curated trending. This route catches what's clustered around our own
 * already-detected high-trend videos: the YouTube algorithmic neighborhood.
 * yt-dlp's Mix-playlist trick (watch?v=VID&list=RDVID --flat-playlist) is
 * the only practical way to read that surface — videos.list and search.list
 * don't expose related-video data anymore.
 *
 * Phase 0 spike (CLAUDE.md) proved yt-dlp runs on Vercel from a /tmp
 * binary downloaded at cold-start. Cold ~5s, warm <1s. We reuse the
 * existing wrapper at src/lib/discovery/ytdlp.ts.
 *
 * Seed selection:
 *   - Pick the top N videos from video_metrics with trend_score > 60 in
 *     the last 48h that we haven't expanded from yet
 *   - For each: fetch ~25 related videos via Mix
 *   - Extract distinct new channelIds, hydrate, classify, insert
 *
 * Idempotency: we mark seeds as expanded by recording (seed_video_id ->
 * channels_added_count) in the discovery_expansion_log table. Each seed
 * is consumed once. If migration 0031 hasn't been applied, the route
 * still runs but doesn't dedup seeds across invocations — acceptable for
 * launch since duplicate Mix crawls are cheap and ON CONFLICT dedup-s the
 * watchlist insert.
 *
 * Quota cost: 0 YouTube API units for the Mix crawl itself (yt-dlp scrapes
 * the watch page directly). hydrateChannels still uses 1 unit per 50 ids.
 *
 * Schedule: every 4h (vercel.json).
 */

import { createServiceClient } from '@/lib/supabase/service'
import { fetchRelatedVideos } from '@/lib/discovery/ytdlp'
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

const SEED_TREND_SCORE_MIN = 60
const SEED_FRESHNESS_HOURS = 48
const SEEDS_PER_RUN = 5
const RELATED_PER_SEED = 25
// SurgeNiche surfaces small channels with breakout videos. The expand
// route operates on viral seeds (already small-channel by virtue of the
// trending discovery filter), but their Mix-playlist neighborhood can
// contain MrBeast-tier channels that the YouTube algorithm clusters with
// any popular video. We keep the same 500k upper cap as the trending
// route so the universe stays focused on the value prop.
const MIN_SUBS = 1_000
const MAX_SUBS = 500_000
// Bound the time we spend on Mix-playlist fetches. yt-dlp is slow + flaky
// against YouTube; a single hung seed shouldn't eat the whole budget.
const TIME_BUDGET_MS = 240_000

interface SeedVideo {
  videoId: string
  title: string | null
  trendScore: number
}

async function fetchExpansionSeeds(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<SeedVideo[]> {
  const since = new Date(
    Date.now() - SEED_FRESHNESS_HOURS * 3600 * 1000,
  ).toISOString()
  const { data, error } = await supabase
    .from('video_metrics')
    .select('video_id, trend_score, computed_at')
    .gte('computed_at', since)
    .gte('trend_score', SEED_TREND_SCORE_MIN)
    .order('trend_score', { ascending: false })
    .limit(SEEDS_PER_RUN * 3) // overfetch — we'll trim after dedup against expanded log

  if (error) {
    console.error('[discovery/expand] seed fetch failed', error.message)
    return []
  }
  if (!data || data.length === 0) return []

  // If a discovery_expansion_log table exists, exclude already-expanded
  // seeds. The route works without the table — it just falls back to
  // per-invocation Mix dedup.
  const videoIds = data.map((r) => r.video_id as string)
  const { data: logRows } = await supabase
    .from('discovery_expansion_log')
    .select('seed_video_id')
    .in('seed_video_id', videoIds)
  const expanded = new Set<string>(
    ((logRows ?? []) as Array<{ seed_video_id: string }>).map(
      (r) => r.seed_video_id,
    ),
  )

  const seeds: SeedVideo[] = []
  for (const r of data) {
    if (expanded.has(r.video_id as string)) continue
    seeds.push({
      videoId: r.video_id as string,
      title: null,
      trendScore: Number(r.trend_score ?? 0),
    })
    if (seeds.length >= SEEDS_PER_RUN) break
  }
  return seeds
}

async function recordExpansion(
  supabase: ReturnType<typeof createServiceClient>,
  seedVideoId: string,
  channelsAdded: number,
): Promise<void> {
  // Best-effort write. If the table doesn't exist, swallow the error so
  // the route keeps running.
  const { error } = await supabase.from('discovery_expansion_log').insert({
    seed_video_id: seedVideoId,
    channels_added: channelsAdded,
    expanded_at: new Date().toISOString(),
  })
  if (error && !/relation .* does not exist/i.test(error.message)) {
    console.error('[discovery/expand] expansion log insert failed', error.message)
  }
}

interface SeedOutcome {
  seedVideoId: string
  trendScore: number
  relatedFetched: number
  newChannels: number
  inserted: number
  outOfBand: number
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

  let seeds: SeedVideo[] = []
  try {
    seeds = await fetchExpansionSeeds(supabase)
  } catch (err) {
    console.error('[discovery/expand] seed fetch crashed', err)
  }

  if (seeds.length === 0) {
    console.log('[discovery/expand] no seeds — skipping run')
    return Response.json({
      ok: true,
      reason: 'no_seeds',
      totalInserted: 0,
      seedsConsidered: 0,
      elapsedMs: Date.now() - startedAt,
    })
  }

  for (const seed of seeds) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      console.warn('[discovery/expand] time budget hit, stopping early')
      break
    }
    const outcome: SeedOutcome = {
      seedVideoId: seed.videoId,
      trendScore: seed.trendScore,
      relatedFetched: 0,
      newChannels: 0,
      inserted: 0,
      outOfBand: 0,
    }
    try {
      const related = await fetchRelatedVideos(seed.videoId, RELATED_PER_SEED)
      outcome.relatedFetched = related.length
      const channelIds = Array.from(
        new Set(
          related
            .map((r) => r.channelId)
            .filter((c): c is string => typeof c === 'string' && c.startsWith('UC')),
        ),
      )
      if (channelIds.length === 0) {
        outcomes.push(outcome)
        await recordExpansion(supabase, seed.videoId, 0)
        continue
      }

      const newIds = await filterNewChannelIds(supabase, channelIds)
      outcome.newChannels = newIds.length
      if (newIds.length === 0) {
        outcomes.push(outcome)
        await recordExpansion(supabase, seed.videoId, 0)
        continue
      }

      const hydrated = await hydrateChannels(apiKey, newIds)
      // Carry one related-item title per channel for classifier context.
      const sampleTitleByChannel = new Map<string, string>()
      for (const r of related) {
        if (r.channelId && !sampleTitleByChannel.has(r.channelId) && r.title) {
          sampleTitleByChannel.set(r.channelId, r.title)
        }
      }

      for (const ch of hydrated) {
        if (ch.subscriberCount < MIN_SUBS || ch.subscriberCount > MAX_SUBS) {
          outcome.outOfBand++
          continue
        }
        if (!ch.title) {
          outcome.outOfBand++
          continue
        }
        const sampleTitles = sampleTitleByChannel.has(ch.channelId)
          ? [sampleTitleByChannel.get(ch.channelId)!]
          : []
        const category = await classifyChannelCategory(
          ch.title,
          ch.description,
          sampleTitles,
        )
        // We don't know recent video durations from the Mix payload
        // reliably. Default to 'longform' — scan/index.ts will pick up
        // shorts via the existing content_type filter on subsequent runs
        // if the channel uploads any.
        const result = await insertCandidateChannel(supabase, {
          youtubeChannelId: ch.channelId,
          channelName: ch.title,
          category,
          contentType: inferContentType(
            related
              .filter((r) => r.channelId === ch.channelId)
              .map((r) => r.durationSeconds ?? 0),
          ),
          language: 'en',
          discoveredVia: 'related_video',
          nicheLabel: '',
        })
        if (result === 'inserted') outcome.inserted++
      }
    } catch (err) {
      console.error(
        '[discovery/expand] seed crawl failed',
        seed.videoId,
        err instanceof Error ? err.message : err,
      )
    }
    outcomes.push(outcome)
    await recordExpansion(supabase, seed.videoId, outcome.inserted)
  }

  const elapsedMs = Date.now() - startedAt
  const totalInserted = outcomes.reduce((s, o) => s + o.inserted, 0)
  console.log(
    '[discovery/expand] done',
    JSON.stringify({ totalInserted, elapsedMs, outcomes }),
  )

  return Response.json({
    ok: true,
    totalInserted,
    seedsConsidered: outcomes.length,
    elapsedMs,
    outcomes,
  })
}
