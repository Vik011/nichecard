// supabase/functions/discover/index.ts
// Sonar discover: seed-driven YouTube search.
// Pulls top N active seed keywords by priority, runs videoCount-ordered video
// search per seed, hydrates each candidate channel, and adds qualifying
// small-to-mid channels to channels_watchlist tagged with the seed term.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  searchVideosByKeyword,
  getChannelStats,
  getVideoStatsBatch,
  getYoutubeKeys,
} from '../_shared/youtube.ts'
import { matchesContentFarmPattern } from '../_shared/premiumSpike.ts'
import type { SeedKeyword } from '../_shared/types.ts'

const SEEDS_PER_RUN = parseInt(Deno.env.get('SEEDS_PER_RUN') ?? '4', 10)
// 2026-05-09 (PR #57): floors raised from 100/1000 to 5000/2000.
// Diagnostic showed 58/109 scanned channels had subs < 1K (mostly shorts
// promoted at the 100-sub floor). They're filtered from /discover anyway
// (PR #49 view), but cost scan-cycle quota. Per user: shorts < 5K subs
// produce too many false-positive spike signals; longform < 2K subs also
// noisy. Tightening the promotion floor saves quota for higher-quality
// candidates.
//
// MAX raised to 400K (was 500K longform / 100K shorts) to align with
// Discord-shared niche-finder (Sprint A.10 reference). 100K-400K creators
// are the sweet spot — established enough to mean spikes are real, small
// enough that rapid growth is still possible.
const MIN_SUBS_SHORTS = 5_000
const MIN_SUBS_LONGFORM = 2_000
const MAX_SUBS_SHORTS = 400_000
const MAX_SUBS_LONGFORM = 400_000
const MAX_AGE_MONTHS_SHORTS = 12
const MAX_AGE_MONTHS_LONGFORM = 24

// Sprint A.8 follow-up — pre-screen thresholds (relaxed vs premiumSpike).
// A candidate channel must have AT LEAST ONE search-hit video (in the recent
// publishedAfter window) clearing both an absolute view floor AND a VPS
// floor. This eliminates "channel matched the keyword but their best recent
// video is a dud" cases at discovery time, instead of letting them rot in
// the watchlist burning scan-cycle YouTube quota.
//
// 2026-05-08: longform gates relaxed further (5K→3K views, 5→2 VPS) after
// the PR #49 quality floor (>=1K subs in scan_results_latest) revealed
// only ~50 niches in the Premium pool. Lower pre-screen lets ~30% more
// near-miss candidates into the watchlist; the downstream premiumSpike
// gate (LONGFORM_VIEWS_MIN=10k, VPS_MIN=10) still rejects obvious junk.
// Shorts gates kept at 15K/200 — shorts seeds were just (re-)introduced
// in 0036 and we want one experiment at a time on the shorts side.
const DISCOVER_MIN_VIEWS_SHORTS = 15_000     // premium SHORTS_VIEWS_MIN is 30k
const DISCOVER_MIN_VIEWS_LONGFORM = 3_000    // premium LONGFORM_VIEWS_MIN is 10k
const DISCOVER_MIN_VPS_SHORTS = 200          // premium SHORTS_VPS_MIN is 1000
const DISCOVER_MIN_VPS_LONGFORM = 2          // premium LONGFORM_VPS_MIN is 10

// Sprint A.10 (PR #56): video count cap blocks aggregator / re-uploader /
// content-farm channels. Stolen from a Discord-shared niche-finder pipeline
// that filtered videoCount <= 150 — works because legitimate creator
// channels in our subscriber range (1K-500K longform, 100-100K shorts)
// publish at human cadence and rarely cross 150-200 videos in their first
// 12-24 months. Higher counts almost always mean: (a) compilation farm,
// (b) re-uploader of viral content, or (c) old account repurposed without
// rebrand. None of those produce premium-spike signals worth our scan
// quota. Shorts cap is higher (500) because shorts creators legitimately
// pump higher cadence (1-3/day during a creator's growth phase).
const MAX_VIDEO_COUNT_LONGFORM = 200
const MAX_VIDEO_COUNT_SHORTS = 500

interface SeedExpansion {
  seed: SeedKeyword
  contentType: 'shorts' | 'longform'
  videoDuration: 'short' | 'medium' | 'long'
  publishedAfterDays: number
  minSubs: number
  maxSubs: number
  maxAgeMonths: number
  regionCode: 'US'
}

function expand(seed: SeedKeyword): SeedExpansion[] {
  // Sprint A.8: scanner is EN-only. The seed query already filters
  // language='en' so a non-EN seed shouldn't reach here, but we hardcode
  // regionCode='US' anyway to be defensive.
  const types: ('shorts' | 'longform')[] =
    seed.content_type === 'both' ? ['shorts', 'longform'] : [seed.content_type as 'shorts' | 'longform']

  // YouTube duration buckets: short (<4min), medium (4-20min), long (>20min).
  // Most premium longform creator content (AI tutorials, productivity, finance)
  // lives in the "medium" bucket. The "long" filter was excluding ~90% of the
  // intended creator pool, hence near-zero longform outliers in early runs.
  return types.map(t => ({
    seed,
    contentType: t,
    videoDuration: t === 'shorts' ? 'short' : 'medium',
    publishedAfterDays: t === 'shorts' ? 2 : 14,
    minSubs: t === 'shorts' ? MIN_SUBS_SHORTS : MIN_SUBS_LONGFORM,
    maxSubs: t === 'shorts' ? MAX_SUBS_SHORTS : MAX_SUBS_LONGFORM,
    maxAgeMonths: t === 'shorts' ? MAX_AGE_MONTHS_SHORTS : MAX_AGE_MONTHS_LONGFORM,
    regionCode: 'US',
  }))
}

Deno.serve(async (_req: Request) => {
  try {
    const youtubeKeys = getYoutubeKeys()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl) throw new Error('SUPABASE_URL not set')
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Rotation: surface least-recently-used seeds first (NULL = never used,
    // wins). Priority is a tie-breaker within the same usage bucket. The
    // previous order put priority first, which kept re-picking the same top
    // keywords forever and never rotated to the lower-priority ones.
    const { data: seedRows, error: seedErr } = await supabase
      .from('seed_keywords')
      .select('*')
      .eq('is_active', true)
      // Sprint A.8: EN-only. DE seeds were soft-deleted via 0021.
      .eq('language', 'en')
      .order('last_used_at', { ascending: true, nullsFirst: true })
      .order('priority', { ascending: false })
      .limit(SEEDS_PER_RUN)
    if (seedErr) throw seedErr
    if (!seedRows || seedRows.length === 0) {
      return new Response(JSON.stringify({ success: true, added: 0, note: 'no active seeds' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { data: existing } = await supabase
      .from('channels_watchlist')
      .select('youtube_channel_id')
    const existingIds = new Set<string>((existing ?? []).map((c: { youtube_channel_id: string }) => c.youtube_channel_id))

    let totalAdded = 0
    const usedSeedIds: string[] = []

    for (const seed of seedRows as SeedKeyword[]) {
      usedSeedIds.push(seed.id)
      for (const exp of expand(seed)) {
        try {
          const publishedAfter = new Date(
            Date.now() - exp.publishedAfterDays * 24 * 60 * 60 * 1000
          ).toISOString()

          const rawHits = await searchVideosByKeyword(youtubeKeys, {
            q: seed.term,
            publishedAfter,
            videoDuration: exp.videoDuration,
            regionCode: exp.regionCode,
            maxResults: 25,
          })

          // Content-farm title filter — strip hits that match the blacklist
          // BEFORE they influence channel selection. Without this, a single
          // softcore-tutorial-style hit on a real niche channel would pull
          // that channel into the watchlist via the high-VPS hit.
          const hits = rawHits.filter(h => !matchesContentFarmPattern(h.title))

          const candidateIds = [...new Set(hits.map(h => h.channelId))]
            .filter(id => !existingIds.has(id))
          if (candidateIds.length === 0) continue

          const stats = await getChannelStats(youtubeKeys, candidateIds)
          const maxAgeMs = exp.maxAgeMonths * 30 * 24 * 60 * 60 * 1000

          // Sprint A.8 follow-up — discover pre-screen: batch-fetch viewCount
          // for every search hit, then index "best hit views per channel".
          // Only channels whose strongest hit clears both the absolute view
          // floor AND the VPS floor get inserted. Without this, channels with
          // one mediocre hit were inflating the watchlist; with it, we admit
          // only candidates that look "near-premium" already.
          const hitVideoIds = [...new Set(hits.map(h => h.videoId))]
          const videoStats = await getVideoStatsBatch(youtubeKeys, hitVideoIds)
          const viewsByVideoId = new Map<string, number>(
            videoStats.map(v => [v.videoId, v.viewCount]),
          )
          const bestHitByChannel = new Map<string, number>()
          for (const hit of hits) {
            const views = viewsByVideoId.get(hit.videoId) ?? 0
            const prev = bestHitByChannel.get(hit.channelId) ?? 0
            if (views > prev) bestHitByChannel.set(hit.channelId, views)
          }

          const minViews = exp.contentType === 'shorts'
            ? DISCOVER_MIN_VIEWS_SHORTS
            : DISCOVER_MIN_VIEWS_LONGFORM
          const minVps = exp.contentType === 'shorts'
            ? DISCOVER_MIN_VPS_SHORTS
            : DISCOVER_MIN_VPS_LONGFORM

          const maxVideoCount = exp.contentType === 'shorts'
            ? MAX_VIDEO_COUNT_SHORTS
            : MAX_VIDEO_COUNT_LONGFORM

          for (const channel of stats) {
            if (existingIds.has(channel.channelId)) continue
            const ageMs = Date.now() - new Date(channel.channelCreatedAt).getTime()
            // Sprint A.8 follow-up: floor at premiumSpike SUBS_MIN. Below this
            // the channel can never qualify premium — skip the watchlist insert
            // entirely instead of paying scan-cycle quota for it.
            if (channel.subscriberCount < exp.minSubs) continue
            if (channel.subscriberCount > exp.maxSubs) continue
            if (ageMs > maxAgeMs) continue

            // Sprint A.10 (PR #56): video count cap blocks aggregator/farm
            // channels. See MAX_VIDEO_COUNT_* constant comments above.
            if (channel.videoCount > maxVideoCount) continue

            // Pre-screen: best search-hit video for this channel must clear
            // both the absolute view floor AND the VPS floor. Both — because
            // a 1M-sub channel making 30k-view shorts looks fine on absolute
            // views but is mediocre on VPS, and vice-versa.
            const bestHitViews = bestHitByChannel.get(channel.channelId) ?? 0
            const bestHitVps = bestHitViews / Math.max(channel.subscriberCount, 1)
            if (bestHitViews < minViews) continue
            if (bestHitVps < minVps) continue

            const { error } = await supabase.from('channels_watchlist').insert({
              youtube_channel_id: channel.channelId,
              channel_name: channel.channelName,
              niche_label: '',                       // filled by clustering pipeline later
              content_type: exp.contentType,
              // Sprint A.8: hardcoded 'en'. Seed query already filters to EN
              // but we don't trust seed.language at write-time — defensive.
              language: 'en',
              seed_keyword: seed.term,
              // Sprint A.10 (PR #56): inherit category_enum value from the
              // seed_keyword that discovered this channel. NULL only if
              // the seed has no category set (legacy DE seeds).
              category: seed.category ?? null,
            })
            if (error) {
              if (error.code !== '23505') {
                console.error(`watchlist insert failed for ${channel.channelId}:`, error)
              }
            } else {
              totalAdded++
              existingIds.add(channel.channelId)
            }
          }
        } catch (err) {
          console.error(`seed=${seed.term} type=${exp.contentType} failed:`, err)
        }
      }
    }

    if (usedSeedIds.length > 0) {
      await supabase
        .from('seed_keywords')
        .update({ last_used_at: new Date().toISOString() })
        .in('id', usedSeedIds)
    }

    return new Response(JSON.stringify({ success: true, added: totalAdded, seeds_used: usedSeedIds.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('discover (sonar) fatal error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
