/**
 * Shared channel-onboarding helpers used by /api/discovery/* routes.
 *
 * The discovery loop has three independent surfaces (trending feed, yt-dlp
 * Mix-playlist expand, future seeds) that all share the same downstream
 * shape: given a YouTube channelId, hydrate stats, classify the niche
 * category, and insert into channels_watchlist as a Tier 1 candidate.
 *
 * This module owns that pipeline. Routes only decide which channelIds to
 * feed in.
 */

import { anthropic } from '@/lib/anthropic/client'
import type { CategoryEnum } from '@/lib/types/database'

const YT_BASE = 'https://www.googleapis.com/youtube/v3'

export interface ChannelHydrationResult {
  channelId: string
  title: string
  description: string
  subscriberCount: number
  videoCount: number
  viewCount: number
  country: string | null
  publishedAt: string | null
  thumbnailUrl: string | null
}

const CATEGORIES: readonly CategoryEnum[] = [
  'ai_tools',
  'finance',
  'crypto',
  'tech_reviews',
  'gaming_streamers',
  'fitness_health',
  'self_improvement',
  'true_crime',
  'luxury_lifestyle',
  'celebrity_drama',
  'geopolitics_news',
  'education_howto',
] as const

const CATEGORY_DESCRIPTIONS: Record<CategoryEnum, string> = {
  ai_tools:         'AI tools, prompts, automation, GPT/Claude/Gemini tutorials',
  finance:          'Personal finance, investing, stocks, real estate, business',
  crypto:           'Cryptocurrency, web3, DeFi, NFTs, trading',
  tech_reviews:     'Phone/laptop/gadget reviews, unboxings, tech comparisons',
  gaming_streamers: 'Gaming, esports, streamers, walkthroughs, reactions',
  fitness_health:   'Workouts, nutrition, weight loss, biohacking, wellness',
  self_improvement: 'Productivity, mindset, habits, motivation, masculinity',
  true_crime:       'True crime, unsolved cases, courtroom recaps, criminal psychology',
  luxury_lifestyle: 'Luxury cars, watches, mansions, conspicuous wealth',
  celebrity_drama:  'Celebrity gossip, breakups, scandals, paparazzi',
  geopolitics_news: 'World news, politics, war analysis, current events',
  education_howto:  'General how-to, tutorials, skills, education (catch-all)',
}

/**
 * Hydrate channels by ID via YouTube channels.list (1 quota unit per call,
 * up to 50 channelIds per call). Returns one entry per channelId that
 * actually exists; missing ids are silently dropped.
 */
export async function hydrateChannels(
  apiKey: string,
  channelIds: string[],
): Promise<ChannelHydrationResult[]> {
  if (channelIds.length === 0) return []
  const results: ChannelHydrationResult[] = []

  // YouTube allows up to 50 ids per channels.list call.
  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50)
    const url = new URL(`${YT_BASE}/channels`)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('part', 'snippet,statistics')
    url.searchParams.set('id', batch.join(','))
    url.searchParams.set('maxResults', '50')

    const res = await fetch(url.toString())
    if (!res.ok) {
      console.error(
        '[discovery] hydrateChannels failed',
        res.status,
        (await res.text()).slice(0, 200),
      )
      continue
    }
    const json = (await res.json()) as {
      items?: Array<{
        id: string
        snippet?: {
          title?: string
          description?: string
          country?: string
          publishedAt?: string
          thumbnails?: {
            high?: { url?: string }
            medium?: { url?: string }
            default?: { url?: string }
          }
        }
        statistics?: {
          subscriberCount?: string
          videoCount?: string
          viewCount?: string
          hiddenSubscriberCount?: boolean
        }
      }>
    }
    for (const item of json.items ?? []) {
      const stats = item.statistics ?? {}
      results.push({
        channelId: item.id,
        title: item.snippet?.title ?? '',
        description: item.snippet?.description ?? '',
        subscriberCount: stats.hiddenSubscriberCount
          ? 0
          : parseInt(stats.subscriberCount ?? '0', 10),
        videoCount: parseInt(stats.videoCount ?? '0', 10),
        viewCount: parseInt(stats.viewCount ?? '0', 10),
        country: item.snippet?.country ?? null,
        publishedAt: item.snippet?.publishedAt ?? null,
        thumbnailUrl:
          item.snippet?.thumbnails?.high?.url ??
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url ??
          null,
      })
    }
  }
  return results
}

/**
 * Classify a channel into one of the 12 industry categories via Claude
 * Haiku. Cheap (~$0.0003 per call), deterministic (temp=0). Falls back to
 * `education_howto` on any parse failure so a single bad call never aborts
 * the discovery batch.
 */
export async function classifyChannelCategory(
  channelTitle: string,
  channelDescription: string,
  recentVideoTitles: string[] = [],
): Promise<CategoryEnum> {
  const titleSample = recentVideoTitles.slice(0, 8).join('\n  ')
  const descTrimmed = channelDescription.slice(0, 600)

  const prompt = `Classify this YouTube channel into ONE of these niches:
${CATEGORIES.map((c) => `- ${c}: ${CATEGORY_DESCRIPTIONS[c]}`).join('\n')}

Channel title: ${channelTitle}
Channel description: ${descTrimmed || '(empty)'}
Sample video titles:
  ${titleSample || '(none available)'}

Return ONLY this JSON (no prose, no markdown fences):
{ "category": "snake_case_id" }`

  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 60,
      temperature: 0,
      system: 'You classify YouTube channels into niche categories. Return strict JSON.',
      messages: [{ role: 'user', content: prompt }],
    })
    const block = resp.content[0]
    if (!block || block.type !== 'text') return 'education_howto'
    const raw = block.text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()
    const parsed = JSON.parse(raw) as { category?: string }
    const cat = parsed.category as CategoryEnum | undefined
    if (cat && (CATEGORIES as readonly string[]).includes(cat)) return cat
    return 'education_howto'
  } catch (err) {
    console.error(
      '[discovery] classifyChannelCategory failed',
      channelTitle,
      err instanceof Error ? err.message : err,
    )
    return 'education_howto'
  }
}

export interface InsertCandidateInput {
  youtubeChannelId: string
  channelName: string
  category: CategoryEnum
  contentType: 'shorts' | 'longform'
  language: 'en' | 'de'
  discoveredVia: string
  nicheLabel?: string
}

/**
 * Insert a Tier 1 candidate channel into channels_watchlist.
 *
 * Idempotent — the table has a UNIQUE constraint on youtube_channel_id,
 * so duplicate inserts no-op via ON CONFLICT DO NOTHING. The promotion
 * cron later flips tier=candidate -> observed -> permanent based on
 * trend_score signal.
 *
 * Returns 'inserted' for a new row, 'skipped' if the channel already
 * exists. Never throws — errors are logged and reported as 'skipped'.
 */
export async function insertCandidateChannel(
  supabase: ReturnType<typeof import('@/lib/supabase/service').createServiceClient>,
  input: InsertCandidateInput,
): Promise<'inserted' | 'skipped'> {
  const row = {
    youtube_channel_id: input.youtubeChannelId,
    channel_name: input.channelName,
    niche_label: input.nicheLabel ?? '',
    content_type: input.contentType,
    language: input.language,
    is_active: true,
    category: input.category,
    tier: 'candidate' as const,
    tier_entered_at: new Date().toISOString(),
    discovered_via: input.discoveredVia,
  }
  // Use upsert with ignoreDuplicates so existing rows are silently kept.
  const { error, count } = await supabase
    .from('channels_watchlist')
    .upsert(row, { onConflict: 'youtube_channel_id', ignoreDuplicates: true, count: 'exact' })

  if (error) {
    console.error(
      '[discovery] insertCandidateChannel failed',
      input.youtubeChannelId,
      error.message,
    )
    return 'skipped'
  }
  return (count ?? 0) > 0 ? 'inserted' : 'skipped'
}

/**
 * Filter out channelIds that are already in channels_watchlist (any tier,
 * including evicted rows we don't want to re-add). Returns the subset that
 * is genuinely new.
 */
export async function filterNewChannelIds(
  supabase: ReturnType<typeof import('@/lib/supabase/service').createServiceClient>,
  channelIds: string[],
): Promise<string[]> {
  if (channelIds.length === 0) return []
  const { data, error } = await supabase
    .from('channels_watchlist')
    .select('youtube_channel_id')
    .in('youtube_channel_id', channelIds)
    .limit(channelIds.length)
  if (error) {
    console.error('[discovery] filterNewChannelIds failed', error.message)
    return channelIds // pessimistic: try inserting all, ON CONFLICT will dedupe
  }
  const known = new Set((data ?? []).map((r) => r.youtube_channel_id as string))
  return channelIds.filter((id) => !known.has(id))
}

/**
 * Default content_type heuristic: if any of a channel's recent videos is
 * <60 seconds we tag the channel as 'shorts', otherwise 'longform'. This
 * is approximate but the scan pipeline only reads videos matching the
 * tagged content_type, so getting it slightly wrong just means we ingest
 * a smaller subset of that channel's catalog.
 */
export function inferContentType(durationsSeconds: number[]): 'shorts' | 'longform' {
  if (durationsSeconds.length === 0) return 'longform'
  const shortish = durationsSeconds.filter((d) => d > 0 && d <= 60).length
  return shortish > durationsSeconds.length / 2 ? 'shorts' : 'longform'
}

export function checkCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const got =
    request.headers.get('x-cron-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    null
  return got === secret
}

export function getYouTubeApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) throw new Error('YOUTUBE_API_KEY not set')
  return key
}
