// supabase/functions/trending/index.ts
//
// Trending discover: bypasses the seed-keyword cold start by pulling
// channels behind YouTube's mostPopular chart per category × region.
//
// Per-run flow:
//   1. For each (categoryId, regionCode) in TRENDING_CATEGORY_MAP × TRENDING_REGIONS:
//      a. videos.list?chart=mostPopular&maxResults=50 (1 unit per call)
//      b. Bucket each video: durationSeconds < 60 → shorts, else → longform
//      c. Dedup by (channelId, content_type) and skip already-watchlisted pairs
//   2. Hydrate unique channels via getChannelStats (1 unit / 50 batch)
//   3. Apply discover-equivalent gates (subs, age, video count)
//   4. Compute niche label via buildNicheLabel (15-20 recent titles) when
//      ANTHROPIC_API_KEY is set; otherwise leave label empty (no useful
//      seed.term fallback for the trending path).
//   5. Insert with seed_keyword='__trending_<categoryId>' for traceability
//
// QUOTA COST: |categories| × |regions| chart calls (1u each) + ~1u per 50
// unique channels for hydration + 2u per labeled candidate (playlistItems +
// videos for recent titles). Current config: 8 categories × 3 regions = 24
// chart units baseline. Sanity-check daily total before expanding either
// dimension — cap is ~10K/day.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getYoutubeKeys,
  getMostPopularVideos,
  getChannelStats,
  getRecentVideos,
} from '../_shared/youtube.ts'
import {
  TRENDING_CATEGORY_MAP,
  TRENDING_REGIONS,
  resolveCategoryEnum,
} from '../_shared/trendingCategoryMap.ts'
import { buildNicheLabel } from '../_shared/labeling.ts'

// Match the gates already used by discover (verified against discover/index.ts
// constants on 2026-05-09). Keep these in sync if discover gates change.
const MIN_SUBS_SHORTS = 5_000
const MIN_SUBS_LONGFORM = 2_000
const MAX_SUBS_SHORTS = 400_000
const MAX_SUBS_LONGFORM = 400_000
const MAX_AGE_MONTHS_SHORTS = 12
const MAX_AGE_MONTHS_LONGFORM = 24
const MAX_VIDEO_COUNT_LONGFORM = 200
const MAX_VIDEO_COUNT_SHORTS = 500

const SHORTS_DURATION_SECONDS = 60

interface ChannelKey {
  channelId: string
  contentType: 'shorts' | 'longform'
}

function keyOf(k: ChannelKey): string {
  return `${k.channelId}::${k.contentType}`
}

Deno.serve(async (_req: Request) => {
  try {
    const youtubeKeys = getYoutubeKeys()
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? null
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl) throw new Error('SUPABASE_URL not set')
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
    if (!anthropicKey) {
      console.warn('ANTHROPIC_API_KEY not set — trending inserts will leave niche_label empty')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Existing watchlist set is keyed by (channelId, content_type) — a single
    // channel can appear once per format.
    const { data: existing } = await supabase
      .from('channels_watchlist')
      .select('youtube_channel_id, content_type')
    const existingKeys = new Set<string>(
      (existing ?? []).map((c: { youtube_channel_id: string; content_type: string }) =>
        `${c.youtube_channel_id}::${c.content_type}`,
      ),
    )

    let totalAdded = 0
    const summary: Array<{ category: string; region: string; added: number; reason?: string }> = []

    for (const categoryId of Object.keys(TRENDING_CATEGORY_MAP)) {
      const entry = TRENDING_CATEGORY_MAP[categoryId]
      const categoryEnum = resolveCategoryEnum(categoryId)!  // map guarantees non-null

      for (const regionCode of TRENDING_REGIONS) {
        try {
          const videos = await getMostPopularVideos(youtubeKeys, {
            videoCategoryId: categoryId,
            regionCode,
            maxResults: 50,
          })
          if (videos.length === 0) {
            summary.push({ category: entry.ytLabel, region: regionCode, added: 0, reason: 'no trending videos' })
            continue
          }

          // Bucket each video by duration → derive (channelId, contentType) pairs.
          const candidatePairs = new Map<string, ChannelKey>()
          for (const v of videos) {
            const contentType: 'shorts' | 'longform' =
              v.durationSeconds > 0 && v.durationSeconds < SHORTS_DURATION_SECONDS ? 'shorts' : 'longform'
            const key: ChannelKey = { channelId: v.channelId, contentType }
            const composite = keyOf(key)
            if (existingKeys.has(composite)) continue
            if (candidatePairs.has(composite)) continue
            candidatePairs.set(composite, key)
          }
          if (candidatePairs.size === 0) {
            summary.push({ category: entry.ytLabel, region: regionCode, added: 0, reason: 'all already in watchlist' })
            continue
          }

          // Hydrate channels (one batch per 50).
          const channelIdsForHydration = [...new Set([...candidatePairs.values()].map(p => p.channelId))]
          const stats = await getChannelStats(youtubeKeys, channelIdsForHydration)
          const statsById = new Map(stats.map(s => [s.channelId, s]))

          let addedThisRun = 0
          for (const pair of candidatePairs.values()) {
            const ch = statsById.get(pair.channelId)
            if (!ch) continue

            // Gates — match discover.
            const minSubs = pair.contentType === 'shorts' ? MIN_SUBS_SHORTS : MIN_SUBS_LONGFORM
            const maxSubs = pair.contentType === 'shorts' ? MAX_SUBS_SHORTS : MAX_SUBS_LONGFORM
            const maxAgeMonths = pair.contentType === 'shorts' ? MAX_AGE_MONTHS_SHORTS : MAX_AGE_MONTHS_LONGFORM
            const maxVideoCount = pair.contentType === 'shorts' ? MAX_VIDEO_COUNT_SHORTS : MAX_VIDEO_COUNT_LONGFORM

            if (ch.subscriberCount < minSubs) continue
            if (ch.subscriberCount > maxSubs) continue
            if (ch.videoCount > maxVideoCount) continue
            const ageMs = Date.now() - new Date(ch.channelCreatedAt).getTime()
            if (ageMs > maxAgeMonths * 30 * 24 * 60 * 60 * 1000) continue

            // Niche label (skipped when ANTHROPIC_API_KEY missing — saves 2
            // YouTube quota units per channel).
            let nicheLabel = ''
            if (anthropicKey) {
              let recentTitles: string[] = []
              try {
                const recent = await getRecentVideos(youtubeKeys, ch.uploadsPlaylistId, 20)
                recentTitles = recent.map(v => v.title).filter(Boolean)
              } catch (err) {
                console.warn(`recent-titles fetch failed for ${ch.channelId}:`, err)
              }
              nicheLabel = await buildNicheLabel({
                apiKey: anthropicKey,
                channelName: ch.channelName,
                recentTitles,
                fallback: '',
              })
            }

            // language: hardcoded 'en' to match discover's EN-only assumption
            // (discover/index.ts comment: "scanner is EN-only"). Trending pulls
            // from US/DE/GB charts but content language is mostly English in all
            // three; if multi-language support is added later, derive from regionCode.
            const { error } = await supabase.from('channels_watchlist').insert({
              youtube_channel_id: ch.channelId,
              channel_name: ch.channelName,
              niche_label: nicheLabel,
              content_type: pair.contentType,
              language: 'en',
              seed_keyword: `__trending_${categoryId}`,
              category: categoryEnum,
            })
            if (error) {
              if (error.code !== '23505') {
                console.error(`trending insert failed for ${ch.channelId}:`, error)
              }
            } else {
              addedThisRun++
              existingKeys.add(keyOf(pair))
            }
          }

          totalAdded += addedThisRun
          summary.push({ category: entry.ytLabel, region: regionCode, added: addedThisRun })
        } catch (err) {
          console.error(`trending ${categoryId}/${regionCode} failed:`, err)
          summary.push({ category: entry.ytLabel, region: regionCode, added: 0, reason: String(err).slice(0, 120) })
        }
      }
    }

    return new Response(JSON.stringify({ success: true, totalAdded, summary }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('trending fatal error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
