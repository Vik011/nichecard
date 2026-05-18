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

// One deduplicated channel candidate, derived from all the Apify video
// items that belong to it. Carries the per-channel signal the edge function
// needs to gate and label the channel before inserting it.
export interface IngestCandidate {
  channelId: string
  // Channel name taken from the best-hit (max viewCount) item.
  channelName: string
  // Max viewCount across the channel's items.
  bestHitViews: number
  // Title of the max-viewCount item.
  bestHitTitle: string
  // searchQuery of the max-viewCount item - the seed term that found it.
  searchQuery: string
  // Every title across the channel's items (used for niche labeling).
  allTitles: string[]
  // (count of isShortsEligible items) / (total items for this channel).
  shortsHitRatio: number
}

/**
 * Group Apify video items by channelId and produce ONE IngestCandidate per
 * channel. Items with a falsy channelId are dropped; channels already in
 * `existingChannelIds` are dropped. The "best hit" is the item with the max
 * viewCount - its title, searchQuery and channelName are used for the
 * candidate. `allTitles` collects every title; `shortsHitRatio` is the share
 * of shorts-eligible items.
 */
export function dedupCandidates(
  items: ApifyVideoItem[],
  existingChannelIds: Set<string>,
): IngestCandidate[] {
  // Preserve first-seen channel order so output is deterministic.
  const byChannel = new Map<string, ApifyVideoItem[]>()
  for (const it of items) {
    if (!it.channelId) continue
    if (existingChannelIds.has(it.channelId)) continue
    const bucket = byChannel.get(it.channelId)
    if (bucket) {
      bucket.push(it)
    } else {
      byChannel.set(it.channelId, [it])
    }
  }

  const candidates: IngestCandidate[] = []
  for (const [channelId, bucket] of byChannel) {
    let best = bucket[0]
    for (const it of bucket) {
      if (it.viewCount > best.viewCount) best = it
    }
    const shortsHits = bucket.filter(it => it.isShortsEligible === true).length
    candidates.push({
      channelId,
      channelName: best.channelName,
      bestHitViews: best.viewCount,
      bestHitTitle: best.title,
      searchQuery: best.searchQuery,
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
