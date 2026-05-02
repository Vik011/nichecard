// supabase/functions/discover/index.ts
// Sonar discover: seed-driven YouTube search.
// Pulls top N active seed keywords by priority, runs videoCount-ordered video
// search per seed, hydrates each candidate channel, and adds qualifying
// small-to-mid channels to channels_watchlist tagged with the seed term.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  searchVideosByKeyword,
  getChannelStats,
  getYoutubeKeys,
} from '../_shared/youtube.ts'
import type { SeedKeyword } from '../_shared/types.ts'

const SEEDS_PER_RUN = parseInt(Deno.env.get('SEEDS_PER_RUN') ?? '4', 10)
const MAX_SUBS_SHORTS = 100_000
const MAX_SUBS_LONGFORM = 500_000
const MAX_AGE_MONTHS_SHORTS = 12
const MAX_AGE_MONTHS_LONGFORM = 24

interface SeedExpansion {
  seed: SeedKeyword
  contentType: 'shorts' | 'longform'
  videoDuration: 'short' | 'medium' | 'long'
  publishedAfterDays: number
  maxSubs: number
  maxAgeMonths: number
  regionCode: 'US' | 'DE'
}

function expand(seed: SeedKeyword): SeedExpansion[] {
  const region = seed.language === 'de' ? 'DE' : 'US'
  const types: ('shorts' | 'longform')[] =
    seed.content_type === 'both' ? ['shorts', 'longform'] : [seed.content_type as 'shorts' | 'longform']

  return types.map(t => ({
    seed,
    contentType: t,
    videoDuration: t === 'shorts' ? 'short' : 'long',
    publishedAfterDays: t === 'shorts' ? 2 : 7,
    maxSubs: t === 'shorts' ? MAX_SUBS_SHORTS : MAX_SUBS_LONGFORM,
    maxAgeMonths: t === 'shorts' ? MAX_AGE_MONTHS_SHORTS : MAX_AGE_MONTHS_LONGFORM,
    regionCode: region,
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

          const hits = await searchVideosByKeyword(youtubeKeys, {
            q: seed.term,
            publishedAfter,
            videoDuration: exp.videoDuration,
            regionCode: exp.regionCode,
            maxResults: 25,
          })

          const candidateIds = [...new Set(hits.map(h => h.channelId))]
            .filter(id => !existingIds.has(id))
          if (candidateIds.length === 0) continue

          const stats = await getChannelStats(youtubeKeys, candidateIds)
          const maxAgeMs = exp.maxAgeMonths * 30 * 24 * 60 * 60 * 1000

          for (const channel of stats) {
            if (existingIds.has(channel.channelId)) continue
            const ageMs = Date.now() - new Date(channel.channelCreatedAt).getTime()
            if (channel.subscriberCount > exp.maxSubs) continue
            if (ageMs > maxAgeMs) continue

            const { error } = await supabase.from('channels_watchlist').insert({
              youtube_channel_id: channel.channelId,
              channel_name: channel.channelName,
              niche_label: '',                       // filled by clustering pipeline later
              content_type: exp.contentType,
              language: seed.language,
              seed_keyword: seed.term,
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
