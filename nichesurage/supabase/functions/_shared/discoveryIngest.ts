// supabase/functions/_shared/discoveryIngest.ts
//
// Apify Discovery Engine Phase 4: pure decision logic for discover-ingest.
//
// Turns a flat list of Apify YouTube-search video items into per-channel
// ingest candidates, and infers whether a channel is a shorts or longform
// channel from the share of shorts-eligible hits.
//
// Pure and deterministic - no IO, fully unit-testable. All IO orchestration
// lives in discover-ingest/index.ts.

import type { ApifyVideoItem } from './apify.ts'

// A video at or under this duration (seconds) is treated as a YouTube Short.
// The actor reports `duration` as a number of seconds.
export const SHORTS_MAX_DURATION_SECONDS = 60

// One deduplicated channel candidate, derived from all the Apify video
// items that belong to it. Carries the per-channel signal the edge function
// needs to gate and label the channel before inserting it.
export interface IngestCandidate {
  channelId: string
  // Channel name taken from the best-hit (max views) item.
  channelName: string
  // Max views across the channel's items.
  bestHitViews: number
  // Title of the max-views item.
  bestHitTitle: string
  // Every title across the channel's items (used for niche labeling).
  allTitles: string[]
  // (count of items with duration <= SHORTS_MAX_DURATION_SECONDS) /
  // (total items for this channel).
  shortsHitRatio: number
}

/**
 * Group Apify video items by `channel.id` and produce ONE IngestCandidate per
 * channel. Items with a falsy `channel.id` are dropped; channels already in
 * `existingChannelIds` are dropped. The "best hit" is the item with the max
 * `views` - its title and channel name are used for the candidate. `allTitles`
 * collects every title; `shortsHitRatio` is the share of items whose
 * `duration` is at or under SHORTS_MAX_DURATION_SECONDS.
 */
export function dedupCandidates(
  items: ApifyVideoItem[],
  existingChannelIds: Set<string>,
): IngestCandidate[] {
  // Preserve first-seen channel order so output is deterministic.
  const byChannel = new Map<string, ApifyVideoItem[]>()
  for (const it of items) {
    if (!it.channel?.id) continue
    if (existingChannelIds.has(it.channel.id)) continue
    const bucket = byChannel.get(it.channel.id)
    if (bucket) {
      bucket.push(it)
    } else {
      byChannel.set(it.channel.id, [it])
    }
  }

  const candidates: IngestCandidate[] = []
  for (const [channelId, bucket] of byChannel) {
    let best = bucket[0]
    for (const it of bucket) {
      if (it.views > best.views) best = it
    }
    const shortsHits = bucket.filter(
      it => it.duration <= SHORTS_MAX_DURATION_SECONDS,
    ).length
    candidates.push({
      channelId,
      channelName: best.channel.name,
      bestHitViews: best.views,
      bestHitTitle: best.title,
      allTitles: bucket.map(it => it.title),
      shortsHitRatio: shortsHits / bucket.length,
    })
  }
  return candidates
}

/**
 * Infer a channel's content type from the share of shorts-eligible hits.
 * A ratio strictly above 0.5 means the channel is predominantly shorts.
 *
 * Tie rule: exactly 0.5 -> 'longform' (a 50/50 split is treated as longform).
 */
export function inferContentType(shortsHitRatio: number): 'shorts' | 'longform' {
  return shortsHitRatio > 0.5 ? 'shorts' : 'longform'
}
