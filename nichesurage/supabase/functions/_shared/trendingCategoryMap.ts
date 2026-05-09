// supabase/functions/_shared/trendingCategoryMap.ts
//
// Maps YouTube videoCategoryId (used by videos.list?chart=mostPopular) to
// the app's category_enum + 7-bucket UI grouping. Each map entry picks a
// SINGLE category_enum value per YouTube category — sub-categorization
// within a bucket (ai_tools vs tech_reviews) is left to the labeling step.
//
// 8 entries cover the YouTube categories we care about. Music (10),
// Comedy (23), Film (1), Pets (15), Travel (19), Cars (2) are intentionally
// skipped — none map cleanly to a SurgeNiche bucket and would dilute results.
//
// Finance has no native YouTube category; coverage relies on the seed-driven
// discover function (Component A in the spec).

export type TrendingBucketId =
  | 'tech-ai'
  | 'finance'
  | 'health'
  | 'lifestyle'
  | 'education'
  | 'gaming'
  | 'entertainment'

export interface TrendingCategoryEntry {
  /** YouTube label for documentation purposes. */
  ytLabel: string
  /** App-side 7-bucket UI grouping. */
  bucketId: TrendingBucketId
  /** Single category_enum value to write to channels_watchlist.category. */
  categoryEnum: string
}

/**
 * The mapping is keyed by YouTube videoCategoryId (string, as used in the
 * URL parameter).
 */
export const TRENDING_CATEGORY_MAP: Record<string, TrendingCategoryEntry> = {
  '28': { ytLabel: 'Science & Technology', bucketId: 'tech-ai',       categoryEnum: 'ai_tools' },
  '27': { ytLabel: 'Education',            bucketId: 'education',     categoryEnum: 'education_howto' },
  '26': { ytLabel: 'Howto & Style',        bucketId: 'lifestyle',     categoryEnum: 'self_improvement' },
  '22': { ytLabel: 'People & Blogs',       bucketId: 'lifestyle',     categoryEnum: 'luxury_lifestyle' },
  '17': { ytLabel: 'Sports',               bucketId: 'health',        categoryEnum: 'fitness_health' },
  '24': { ytLabel: 'Entertainment',        bucketId: 'entertainment', categoryEnum: 'celebrity_drama' },
  '25': { ytLabel: 'News & Politics',      bucketId: 'entertainment', categoryEnum: 'geopolitics_news' },
  '20': { ytLabel: 'Gaming',               bucketId: 'gaming',        categoryEnum: 'gaming_streamers' },
}

export function resolveCategoryEnum(categoryId: string): string | null {
  return TRENDING_CATEGORY_MAP[categoryId]?.categoryEnum ?? null
}

/** Regions covered by the trending function. US + DE matches Sonar; GB adds
 * a third English trending culture (often diverges from US for Lifestyle/Entertainment).
 * Note: 'GB' is the ISO 3166-1 alpha-2 code for the United Kingdom — YouTube's
 * regionCode parameter expects ISO codes, so 'UK' would be silently rejected. */
export const TRENDING_REGIONS: ReadonlyArray<'US' | 'DE' | 'GB'> = ['US', 'DE', 'GB']
