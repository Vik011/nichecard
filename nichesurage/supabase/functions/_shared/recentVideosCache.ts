// supabase/functions/_shared/recentVideosCache.ts
//
// Maps the scan function's already-fetched recent-uploads objects (the
// getRecentVideosWithStats / VideoSnapshot shape) into the ChannelVideo shape
// stored in the `channel_recent_videos` cache and rendered by the niche-detail
// ChannelVideoGrid. Extracted to _shared so it can be unit-tested in isolation
// (the scan entrypoint runs Deno.serve on import and can't be imported by a test).
//
// Contract (must match src/lib/types ChannelVideo + ChannelVideoGrid VideoTile):
//   { id, title, thumbnail, viewCount, publishedAt }
//
// Run tests: deno test supabase/functions/_shared/recentVideosCache.test.ts

export interface ChannelVideoCacheItem {
  id: string
  title: string
  thumbnail: string
  viewCount: number
  publishedAt: string
}

/** Minimal structural subset of getRecentVideosWithStats() output we consume. */
export interface RecentVideoInput {
  videoId?: string
  thumbnailUrl?: string
  title?: string
  viewCount?: number
  publishedAt?: string
}

const MAX_CACHED = 12

/**
 * Build the cached ChannelVideo[] for one channel:
 *   videoId → id, thumbnailUrl → thumbnail (renames);
 *   title / viewCount / publishedAt preserved;
 *   drop entries without a usable videoId (would render a broken watch link);
 *   default missing strings to '', coerce non-finite viewCount to 0;
 *   newest-first, capped at 12.
 * Pure + defensive: never throws on malformed/partial input.
 */
export function toRecentVideoCache(
  videos: ReadonlyArray<RecentVideoInput> | null | undefined,
): ChannelVideoCacheItem[] {
  return (videos ?? [])
    .filter((v): v is RecentVideoInput =>
      !!v && typeof v.videoId === 'string' && v.videoId.length > 0,
    )
    .map((v) => ({
      id: v.videoId as string,
      title: v.title ?? '',
      thumbnail: v.thumbnailUrl ?? '',
      viewCount: Number.isFinite(v.viewCount) ? (v.viewCount as number) : 0,
      publishedAt: v.publishedAt ?? '',
    }))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, MAX_CACHED)
}
