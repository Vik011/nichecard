# YouTube Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two Supabase Edge Functions (`discover` + `scan`) scheduled via pg_cron that automatically populate `scan_results` with fast-growing YouTube channels, labeled by Claude Haiku.

**Architecture:** A daily `discover` function finds new channels via YouTube search.list and adds them to `channels_watchlist`. An hourly `scan` function reads that watchlist, fetches fresh stats, computes metrics, and inserts rows into `scan_results`. Shared utility code lives in `supabase/functions/_shared/`.

**Tech Stack:** Deno (Edge Function runtime), Supabase JS v2, YouTube Data API v3, Anthropic API (Claude Haiku), pg_cron + pg_net for scheduling.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/0003_channels_watchlist.sql` | New table + RLS |
| Create | `supabase/functions/_shared/types.ts` | Shared TypeScript types |
| Create | `supabase/functions/_shared/metrics.ts` | Pure metric calculation functions |
| Create | `supabase/functions/_shared/metrics.test.ts` | Deno unit tests for metrics |
| Create | `supabase/functions/_shared/youtube.ts` | YouTube API helpers |
| Create | `supabase/functions/_shared/anthropic.ts` | Claude Haiku niche labeling |
| Create | `supabase/functions/discover/index.ts` | Daily discovery Edge Function |
| Create | `supabase/functions/scan/index.ts` | Hourly scan Edge Function |

---

## Task 1: Migration — channels_watchlist table

**Files:**
- Create: `supabase/migrations/0003_channels_watchlist.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/0003_channels_watchlist.sql
create table public.channels_watchlist (
  id uuid primary key default gen_random_uuid(),
  youtube_channel_id text not null unique,
  channel_name text not null,
  niche_label text not null default '',
  content_type text not null check (content_type in ('shorts', 'longform')),
  language text not null check (language in ('en', 'de')),
  first_discovered_at timestamptz not null default now(),
  last_scanned_at timestamptz,
  is_active boolean not null default true
);

alter table public.channels_watchlist enable row level security;

create policy "Authenticated users can read watchlist" on public.channels_watchlist
  for select using (auth.role() = 'authenticated');
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Go to Supabase Dashboard → SQL Editor → paste the SQL above → Run.

Verify: `select count(*) from public.channels_watchlist;` returns `0`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_channels_watchlist.sql
git commit -m "feat: add channels_watchlist migration"
```

---

## Task 2: Shared types

**Files:**
- Create: `supabase/functions/_shared/types.ts`

- [ ] **Step 1: Create types file**

```typescript
// supabase/functions/_shared/types.ts

export interface WatchlistChannel {
  id: string
  youtube_channel_id: string
  channel_name: string
  niche_label: string
  content_type: 'shorts' | 'longform'
  language: 'en' | 'de'
  is_active: boolean
}

export interface YouTubeChannelData {
  channelId: string
  channelName: string
  subscriberCount: number
  videoCount: number
  channelCreatedAt: string
  uploadsPlaylistId: string
}

export interface VideoData {
  videoId: string
  title: string
  viewCount: number
  likeCount: number
  commentCount: number
  publishedAt: string
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/types.ts
git commit -m "feat: add Edge Function shared types"
```

---

## Task 3: Metrics calculator (TDD)

**Files:**
- Create: `supabase/functions/_shared/metrics.ts`
- Create: `supabase/functions/_shared/metrics.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// supabase/functions/_shared/metrics.test.ts
import { assertEquals, assertAlmostEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  computeViews48h,
  computeViewsAvg,
  computeSpikeMultiplier,
  computeEngagementRate,
  computeViralityRating,
  computeOpportunityScore,
  computeHookScore,
  computeCompetitionScore,
} from './metrics.ts'
import type { VideoData } from './types.ts'

function makeVideo(overrides: Partial<VideoData> = {}): VideoData {
  return {
    videoId: 'v1',
    title: 'Test',
    viewCount: 1000,
    likeCount: 50,
    commentCount: 10,
    publishedAt: new Date().toISOString(),
    ...overrides,
  }
}

Deno.test('computeViews48h sums views for recent videos only', () => {
  const recent = makeVideo({ viewCount: 5000, publishedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString() })
  const old = makeVideo({ viewCount: 9000, publishedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString() })
  assertEquals(computeViews48h([recent, old]), 5000)
})

Deno.test('computeViews48h returns 0 when no recent videos', () => {
  const old = makeVideo({ viewCount: 9000, publishedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString() })
  assertEquals(computeViews48h([old]), 0)
})

Deno.test('computeViewsAvg returns mean across all videos', () => {
  const videos = [makeVideo({ viewCount: 1000 }), makeVideo({ viewCount: 3000 })]
  assertEquals(computeViewsAvg(videos), 2000)
})

Deno.test('computeViewsAvg returns 0 for empty array', () => {
  assertEquals(computeViewsAvg([]), 0)
})

Deno.test('computeSpikeMultiplier divides views48h by avg', () => {
  assertAlmostEquals(computeSpikeMultiplier(10000, 1000), 10, 0.001)
})

Deno.test('computeSpikeMultiplier caps at 50', () => {
  assertEquals(computeSpikeMultiplier(100000, 1000), 50)
})

Deno.test('computeSpikeMultiplier returns 0 when avg is 0', () => {
  assertEquals(computeSpikeMultiplier(5000, 0), 0)
})

Deno.test('computeEngagementRate sums likes+comments over views', () => {
  const v = makeVideo({ viewCount: 1000, likeCount: 80, commentCount: 20 })
  assertAlmostEquals(computeEngagementRate(v), 0.1, 0.001)
})

Deno.test('computeEngagementRate returns 0 when views is 0', () => {
  assertEquals(computeEngagementRate(makeVideo({ viewCount: 0 })), 0)
})

Deno.test('computeViralityRating returns excellent for >= 10x', () => {
  assertEquals(computeViralityRating(10), 'excellent')
  assertEquals(computeViralityRating(15), 'excellent')
})

Deno.test('computeViralityRating returns good for >= 3x', () => {
  assertEquals(computeViralityRating(3), 'good')
  assertEquals(computeViralityRating(9.9), 'good')
})

Deno.test('computeViralityRating returns average for < 3x', () => {
  assertEquals(computeViralityRating(2.9), 'average')
  assertEquals(computeViralityRating(0), 'average')
})

Deno.test('computeOpportunityScore is 0-100', () => {
  const score = computeOpportunityScore(5, 50000, new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(), 'shorts')
  assertEquals(score >= 0 && score <= 100, true)
})

Deno.test('computeOpportunityScore is higher for newer channel', () => {
  const newChannel = computeOpportunityScore(5, 10000, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), 'shorts')
  const oldChannel = computeOpportunityScore(5, 10000, new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(), 'shorts')
  assertEquals(newChannel > oldChannel, true)
})

Deno.test('computeHookScore returns likes/views * 100', () => {
  const v = makeVideo({ viewCount: 1000, likeCount: 100 })
  assertAlmostEquals(computeHookScore(v)!, 10, 0.001)
})

Deno.test('computeHookScore returns null when views is 0', () => {
  assertEquals(computeHookScore(makeVideo({ viewCount: 0 })), null)
})

Deno.test('computeCompetitionScore is 100 for max_subs', () => {
  assertEquals(computeCompetitionScore(100000, 100000), 100)
})

Deno.test('computeCompetitionScore is 0 for 0 subs', () => {
  assertEquals(computeCompetitionScore(0, 100000), 0)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd nichesurage
deno test supabase/functions/_shared/metrics.test.ts
```

Expected: Error — `metrics.ts` not found (or import errors).

- [ ] **Step 3: Implement metrics.ts**

```typescript
// supabase/functions/_shared/metrics.ts
import type { VideoData } from './types.ts'

export function computeViews48h(videos: VideoData[]): number {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000)
  return videos
    .filter(v => new Date(v.publishedAt) >= cutoff)
    .reduce((sum, v) => sum + v.viewCount, 0)
}

export function computeViewsAvg(videos: VideoData[]): number {
  if (videos.length === 0) return 0
  return videos.reduce((sum, v) => sum + v.viewCount, 0) / videos.length
}

export function computeSpikeMultiplier(views48h: number, viewsAvg: number): number {
  if (viewsAvg === 0) return 0
  return Math.min(views48h / viewsAvg, 50)
}

export function computeEngagementRate(video: VideoData): number {
  if (video.viewCount === 0) return 0
  return (video.likeCount + video.commentCount) / video.viewCount
}

export function computeViralityRating(spikeMultiplier: number): 'excellent' | 'good' | 'average' {
  if (spikeMultiplier >= 10) return 'excellent'
  if (spikeMultiplier >= 3) return 'good'
  return 'average'
}

export function computeOpportunityScore(
  spikeMultiplier: number,
  subscriberCount: number,
  channelCreatedAt: string,
  contentType: 'shorts' | 'longform'
): number {
  const maxSubs = contentType === 'shorts' ? 100_000 : 500_000
  const channelAgeDays = (Date.now() - new Date(channelCreatedAt).getTime()) / (1000 * 60 * 60 * 24)

  const spikeScore = Math.min(spikeMultiplier / 20, 1) * 40
  const sizeScore = Math.max(0, 1 - subscriberCount / maxSubs) * 30
  const ageScore = Math.max(0, 1 - channelAgeDays / 365) * 30

  return Math.round(spikeScore + sizeScore + ageScore)
}

export function computeHookScore(video: VideoData): number | null {
  if (video.viewCount === 0) return null
  return (video.likeCount / video.viewCount) * 100
}

export function computeCompetitionScore(subscriberCount: number, maxSubs: number): number {
  return Math.round((subscriberCount / maxSubs) * 100)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
deno test supabase/functions/_shared/metrics.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/metrics.ts supabase/functions/_shared/metrics.test.ts
git commit -m "feat: add metrics calculator with tests"
```

---

## Task 4: YouTube API client

**Files:**
- Create: `supabase/functions/_shared/youtube.ts`

- [ ] **Step 1: Create youtube.ts**

```typescript
// supabase/functions/_shared/youtube.ts
import type { YouTubeChannelData, VideoData } from './types.ts'

const BASE = 'https://www.googleapis.com/youtube/v3'

export async function searchChannelIds(
  apiKey: string,
  params: {
    videoDuration: 'short' | 'long'
    publishedAfter: string
    regionCode: 'US' | 'DE'
    pageToken?: string
  }
): Promise<{ channelIds: string[]; nextPageToken?: string }> {
  const url = new URL(`${BASE}/search`)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('type', 'video')
  url.searchParams.set('videoDuration', params.videoDuration)
  url.searchParams.set('publishedAfter', params.publishedAfter)
  url.searchParams.set('order', 'viewCount')
  url.searchParams.set('regionCode', params.regionCode)
  url.searchParams.set('maxResults', '50')
  if (params.pageToken) url.searchParams.set('pageToken', params.pageToken)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`search.list failed ${res.status}: ${await res.text()}`)
  const data = await res.json()

  const channelIds: string[] = (data.items ?? [])
    .map((item: { snippet?: { channelId?: string } }) => item.snippet?.channelId)
    .filter(Boolean)

  return { channelIds, nextPageToken: data.nextPageToken }
}

export async function getChannelStats(
  apiKey: string,
  channelIds: string[]
): Promise<YouTubeChannelData[]> {
  const results: YouTubeChannelData[] = []

  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50)
    const url = new URL(`${BASE}/channels`)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('part', 'snippet,statistics,contentDetails')
    url.searchParams.set('id', batch.join(','))
    url.searchParams.set('maxResults', '50')

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`channels.list failed ${res.status}: ${await res.text()}`)
    const data = await res.json()

    for (const item of data.items ?? []) {
      results.push({
        channelId: item.id,
        channelName: item.snippet.title,
        subscriberCount: parseInt(item.statistics.subscriberCount ?? '0', 10),
        videoCount: parseInt(item.statistics.videoCount ?? '0', 10),
        channelCreatedAt: item.snippet.publishedAt,
        uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
      })
    }
  }

  return results
}

export async function getRecentVideos(
  apiKey: string,
  uploadsPlaylistId: string,
  maxResults = 20
): Promise<VideoData[]> {
  const playlistUrl = new URL(`${BASE}/playlistItems`)
  playlistUrl.searchParams.set('key', apiKey)
  playlistUrl.searchParams.set('part', 'contentDetails')
  playlistUrl.searchParams.set('playlistId', uploadsPlaylistId)
  playlistUrl.searchParams.set('maxResults', String(maxResults))

  const playlistRes = await fetch(playlistUrl.toString())
  if (!playlistRes.ok) throw new Error(`playlistItems.list failed ${playlistRes.status}`)
  const playlistData = await playlistRes.json()

  const videoIds: string[] = (playlistData.items ?? [])
    .map((item: { contentDetails?: { videoId?: string } }) => item.contentDetails?.videoId)
    .filter(Boolean)

  if (videoIds.length === 0) return []

  const videosUrl = new URL(`${BASE}/videos`)
  videosUrl.searchParams.set('key', apiKey)
  videosUrl.searchParams.set('part', 'snippet,statistics')
  videosUrl.searchParams.set('id', videoIds.join(','))

  const videosRes = await fetch(videosUrl.toString())
  if (!videosRes.ok) throw new Error(`videos.list failed ${videosRes.status}`)
  const videosData = await videosRes.json()

  return (videosData.items ?? []).map((item: {
    id: string
    snippet: { title: string; publishedAt: string }
    statistics: { viewCount?: string; likeCount?: string; commentCount?: string }
  }) => ({
    videoId: item.id,
    title: item.snippet.title,
    viewCount: parseInt(item.statistics.viewCount ?? '0', 10),
    likeCount: parseInt(item.statistics.likeCount ?? '0', 10),
    commentCount: parseInt(item.statistics.commentCount ?? '0', 10),
    publishedAt: item.snippet.publishedAt,
  }))
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/youtube.ts
git commit -m "feat: add YouTube API client helper"
```

---

## Task 5: Anthropic niche labeling helper

**Files:**
- Create: `supabase/functions/_shared/anthropic.ts`

- [ ] **Step 1: Create anthropic.ts**

```typescript
// supabase/functions/_shared/anthropic.ts

export async function getNicheLabel(
  apiKey: string,
  channelName: string,
  topVideoTitles: string[]
): Promise<string> {
  const titlesText = topVideoTitles.map(t => `- ${t}`).join('\n')

  const prompt = `Given this YouTube channel name and its top video titles, return a short niche label (2-4 words, English).

Channel: ${channelName}
Top videos:
${titlesText}

Respond with only the niche label, nothing else.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) throw new Error(`Anthropic API failed ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return (data.content[0].text as string).trim()
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/anthropic.ts
git commit -m "feat: add Anthropic niche labeling helper"
```

---

## Task 6: discover Edge Function

**Files:**
- Create: `supabase/functions/discover/index.ts`

- [ ] **Step 1: Create discover/index.ts**

```typescript
// supabase/functions/discover/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { searchChannelIds, getChannelStats, getRecentVideos } from '../_shared/youtube.ts'
import { getNicheLabel } from '../_shared/anthropic.ts'

interface Combination {
  contentType: 'shorts' | 'longform'
  language: 'en' | 'de'
  regionCode: 'US' | 'DE'
  videoDuration: 'short' | 'long'
  publishedAfterDays: number
  maxSubscribers: number
  maxAgeMonths: number
}

const COMBINATIONS: Combination[] = [
  { contentType: 'shorts', language: 'en', regionCode: 'US', videoDuration: 'short', publishedAfterDays: 2, maxSubscribers: 100_000, maxAgeMonths: 12 },
  { contentType: 'shorts', language: 'de', regionCode: 'DE', videoDuration: 'short', publishedAfterDays: 2, maxSubscribers: 100_000, maxAgeMonths: 12 },
  { contentType: 'longform', language: 'en', regionCode: 'US', videoDuration: 'long', publishedAfterDays: 7, maxSubscribers: 500_000, maxAgeMonths: 24 },
  { contentType: 'longform', language: 'de', regionCode: 'DE', videoDuration: 'long', publishedAfterDays: 7, maxSubscribers: 500_000, maxAgeMonths: 24 },
]

Deno.serve(async (_req: Request) => {
  try {
    const youtubeKey = Deno.env.get('YOUTUBE_API_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: existing } = await supabase
      .from('channels_watchlist')
      .select('youtube_channel_id')
    const existingIds = new Set<string>((existing ?? []).map((c: { youtube_channel_id: string }) => c.youtube_channel_id))

    let totalAdded = 0

    for (const combo of COMBINATIONS) {
      try {
        const publishedAfter = new Date(Date.now() - combo.publishedAfterDays * 24 * 60 * 60 * 1000).toISOString()

        // Collect channel IDs across 5 paginated search.list calls
        const channelIdSet = new Set<string>()
        let pageToken: string | undefined
        for (let page = 0; page < 5; page++) {
          const { channelIds, nextPageToken } = await searchChannelIds(youtubeKey, {
            videoDuration: combo.videoDuration,
            publishedAfter,
            regionCode: combo.regionCode,
            pageToken,
          })
          channelIds.forEach(id => channelIdSet.add(id))
          if (!nextPageToken) break
          pageToken = nextPageToken
        }

        const newIds = [...channelIdSet].filter(id => !existingIds.has(id))
        if (newIds.length === 0) continue

        const statsArray = await getChannelStats(youtubeKey, newIds)
        const maxAgeMs = combo.maxAgeMonths * 30 * 24 * 60 * 60 * 1000

        const qualifying = statsArray.filter(ch => {
          const ageMs = Date.now() - new Date(ch.channelCreatedAt).getTime()
          return ch.subscriberCount <= combo.maxSubscribers && ageMs <= maxAgeMs
        })

        for (const channel of qualifying) {
          // Skip if another combination already added this channel in this run
          if (existingIds.has(channel.channelId)) continue

          let nicheLabel = ''
          try {
            const videos = await getRecentVideos(youtubeKey, channel.uploadsPlaylistId, 5)
            const titles = videos.map(v => v.title)
            nicheLabel = await getNicheLabel(anthropicKey, channel.channelName, titles)
          } catch (err) {
            console.error(`Labeling failed for ${channel.channelName}:`, err)
          }

          const { error } = await supabase.from('channels_watchlist').insert({
            youtube_channel_id: channel.channelId,
            channel_name: channel.channelName,
            niche_label: nicheLabel,
            content_type: combo.contentType,
            language: combo.language,
          })

          if (error) {
            if (error.code !== '23505') {
              console.error(`Insert failed for ${channel.channelId}:`, error)
            }
          } else {
            totalAdded++
            existingIds.add(channel.channelId)
          }
        }
      } catch (err) {
        console.error(`Combination ${combo.contentType}/${combo.language} failed:`, err)
      }
    }

    return new Response(JSON.stringify({ success: true, added: totalAdded }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Discover fatal error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/discover/index.ts
git commit -m "feat: add discover Edge Function"
```

---

## Task 7: scan Edge Function

**Files:**
- Create: `supabase/functions/scan/index.ts`

- [ ] **Step 1: Create scan/index.ts**

```typescript
// supabase/functions/scan/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getChannelStats, getRecentVideos } from '../_shared/youtube.ts'
import {
  computeViews48h,
  computeViewsAvg,
  computeSpikeMultiplier,
  computeEngagementRate,
  computeViralityRating,
  computeOpportunityScore,
  computeHookScore,
  computeCompetitionScore,
} from '../_shared/metrics.ts'
import type { WatchlistChannel } from '../_shared/types.ts'

Deno.serve(async (_req: Request) => {
  try {
    const youtubeKey = Deno.env.get('YOUTUBE_API_KEY')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: channels, error: fetchError } = await supabase
      .from('channels_watchlist')
      .select('*')
      .eq('is_active', true)

    if (fetchError) throw fetchError

    if (!channels || channels.length === 0) {
      return new Response(JSON.stringify({ success: true, scanned: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Batch-fetch channel stats (cheap: 1 unit per 50 channels)
    const channelIds = (channels as WatchlistChannel[]).map(c => c.youtube_channel_id)
    const statsArray = await getChannelStats(youtubeKey, channelIds)
    const statsMap = new Map(statsArray.map(s => [s.channelId, s]))

    let scanned = 0
    const now = new Date().toISOString()

    for (const channel of channels as WatchlistChannel[]) {
      try {
        const stats = statsMap.get(channel.youtube_channel_id)
        if (!stats) continue

        const videos = await getRecentVideos(youtubeKey, stats.uploadsPlaylistId, 20)
        if (videos.length === 0) continue

        const views48h = computeViews48h(videos)
        const viewsAvg = computeViewsAvg(videos)
        const spikeMultiplier = computeSpikeMultiplier(views48h, viewsAvg)
        const mostRecent = videos[0]
        const engagementRate = computeEngagementRate(mostRecent)
        const viralityRating = computeViralityRating(spikeMultiplier)
        const opportunityScore = computeOpportunityScore(
          spikeMultiplier,
          stats.subscriberCount,
          stats.channelCreatedAt,
          channel.content_type
        )

        const maxSubs = channel.content_type === 'shorts' ? 100_000 : 500_000
        const hookScore = channel.content_type === 'shorts' ? computeHookScore(mostRecent) : null
        const competitionScore = channel.content_type === 'longform'
          ? computeCompetitionScore(stats.subscriberCount, maxSubs)
          : null

        const channelCreatedDate = new Date(stats.channelCreatedAt).toISOString().split('T')[0]

        const { error: insertError } = await supabase.from('scan_results').insert({
          youtube_channel_id: channel.youtube_channel_id,
          channel_name: stats.channelName,
          niche_label: channel.niche_label,
          channel_url: `https://www.youtube.com/channel/${channel.youtube_channel_id}`,
          channel_created_at: channelCreatedDate,
          video_count: stats.videoCount,
          subscriber_count: stats.subscriberCount,
          views_48h,
          views_avg: Math.round(viewsAvg),
          spike_multiplier: parseFloat(spikeMultiplier.toFixed(2)),
          engagement_rate: parseFloat(engagementRate.toFixed(4)),
          opportunity_score: opportunityScore,
          virality_rating: viralityRating,
          language: channel.language,
          content_type: channel.content_type,
          hook_score: hookScore !== null ? parseFloat(hookScore.toFixed(2)) : null,
          avg_view_duration_pct: null,
          search_volume: null,
          competition_score: competitionScore,
        })

        if (insertError) {
          console.error(`scan_results insert failed for ${channel.youtube_channel_id}:`, insertError)
        }

        await supabase
          .from('channels_watchlist')
          .update({ last_scanned_at: now })
          .eq('id', channel.id)

        scanned++
      } catch (err) {
        console.error(`Scan failed for channel ${channel.youtube_channel_id}:`, err)
      }
    }

    return new Response(JSON.stringify({ success: true, scanned }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Scan fatal error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/scan/index.ts
git commit -m "feat: add scan Edge Function"
```

---

## Task 8: Deploy Edge Functions

- [ ] **Step 1: Install Supabase CLI (if not installed)**

```bash
npm install -g supabase
```

- [ ] **Step 2: Login and link project**

```bash
cd nichesurage
supabase login
supabase link --project-ref qwedflkklenqbijheasx
```

- [ ] **Step 3: Set Edge Function secrets**

```bash
supabase secrets set YOUTUBE_API_KEY=<paste from Google Cloud Console>
supabase secrets set ANTHROPIC_API_KEY=<paste from console.anthropic.com>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<paste from Supabase Settings → API>
```

`SUPABASE_URL` is automatically injected by Supabase — no need to set it.

- [ ] **Step 4: Deploy both functions**

```bash
supabase functions deploy discover
supabase functions deploy scan
```

Expected output for each: `Function deployed: discover` (or `scan`).

- [ ] **Step 5: Invoke discover manually to verify it runs**

Go to Supabase Dashboard → Edge Functions → discover → Invoke.

Or via CLI:
```bash
supabase functions invoke discover --no-verify-jwt
```

Expected: `{"success":true,"added":<N>}` (no error).

- [ ] **Step 6: Check channels_watchlist has rows**

In Supabase SQL Editor:
```sql
select youtube_channel_id, channel_name, niche_label, content_type, language
from public.channels_watchlist
limit 10;
```

Expected: Rows with channel names and niche labels.

- [ ] **Step 7: Invoke scan manually**

```bash
supabase functions invoke scan --no-verify-jwt
```

Expected: `{"success":true,"scanned":<N>}`

- [ ] **Step 8: Verify scan_results has data**

```sql
select channel_name, niche_label, content_type, opportunity_score, virality_rating
from public.scan_results
order by opportunity_score desc
limit 10;
```

Expected: Rows with non-null values in all columns.

---

## Task 9: Schedule with pg_cron

- [ ] **Step 1: Enable pg_cron and pg_net extensions**

In Supabase Dashboard → Database → Extensions → search "pg_cron" → Enable.
Then search "pg_net" → Enable.

- [ ] **Step 2: Schedule discover (daily 06:00 UTC)**

In Supabase SQL Editor. Replace `<YOUR_SERVICE_ROLE_KEY>` with the key from Supabase Dashboard → Settings → API → `service_role` key (starts with `eyJ...`).

```sql
select cron.schedule(
  'youtube-discover-daily',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://qwedflkklenqbijheasx.supabase.co/functions/v1/discover',
    headers := '{"Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 3: Schedule scan (every hour)**

Same replacement — use the same service role key.

```sql
select cron.schedule(
  'youtube-scan-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://qwedflkklenqbijheasx.supabase.co/functions/v1/scan',
    headers := '{"Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

> The service role key in cron SQL is safe — it runs server-side in your Postgres instance and is never exposed to clients.

- [ ] **Step 4: Verify cron jobs are registered**

```sql
select jobname, schedule, active from cron.job;
```

Expected: Two rows — `youtube-discover-daily` and `youtube-scan-hourly`.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: YouTube scanner — discover + scan Edge Functions with pg_cron scheduling"
```
