/**
 * 7 user-facing category buckets aggregating the 12 underlying
 * `category_enum` values (defined in 0024_trend_engine_schema.sql).
 *
 * The 12-enum schema came from Sprint B's trend engine; deprecated in PR #47
 * but the column + values are still used by the discover pipeline as of PR #56.
 * 7 buckets is the right granularity for /discover chips — fewer chips = less
 * decision fatigue, but each bucket still maps to a coherent audience vertical.
 *
 * Bucket → enum value mapping (must stay in sync with seed_keywords category
 * values inserted by 0038/0039 migrations):
 *
 *   tech-ai       → ai_tools, tech_reviews
 *   finance       → finance, crypto
 *   health        → fitness_health
 *   lifestyle     → self_improvement, luxury_lifestyle
 *   education     → education_howto
 *   gaming        → gaming_streamers
 *   entertainment → true_crime, celebrity_drama, geopolitics_news
 */

export type CategoryBucketId =
  | 'tech-ai'
  | 'finance'
  | 'health'
  | 'lifestyle'
  | 'education'
  | 'gaming'
  | 'entertainment'

export interface CategoryBucket {
  id: CategoryBucketId
  /** Display label on the chip — short, user-friendly. */
  label: string
  /** Underlying category_enum values aggregated into this bucket. */
  enumValues: string[]
}

export const CATEGORY_BUCKETS: CategoryBucket[] = [
  { id: 'tech-ai',       label: 'Tech & AI',     enumValues: ['ai_tools', 'tech_reviews'] },
  { id: 'finance',       label: 'Finance',       enumValues: ['finance', 'crypto'] },
  { id: 'health',        label: 'Health',        enumValues: ['fitness_health'] },
  { id: 'lifestyle',     label: 'Lifestyle',     enumValues: ['self_improvement', 'luxury_lifestyle'] },
  { id: 'education',     label: 'Education',     enumValues: ['education_howto'] },
  { id: 'gaming',        label: 'Gaming',        enumValues: ['gaming_streamers'] },
  { id: 'entertainment', label: 'Entertainment', enumValues: ['true_crime', 'celebrity_drama', 'geopolitics_news'] },
]

/**
 * Resolve a single user-facing bucket id to its underlying enum values.
 * Returns [] if the id is unknown (defensive — let callers treat this as
 * "no filter" rather than blowing up).
 */
export function bucketToEnumValues(id: CategoryBucketId | null): string[] {
  if (id === null) return []
  const bucket = CATEGORY_BUCKETS.find((b) => b.id === id)
  return bucket?.enumValues ?? []
}

/**
 * Reverse lookup: given a category_enum value (e.g. from a niche row),
 * find which user-facing bucket it belongs to.
 * Returns null if no bucket contains it.
 */
export function enumValueToBucket(enumValue: string | null | undefined): CategoryBucketId | null {
  if (!enumValue) return null
  for (const bucket of CATEGORY_BUCKETS) {
    if (bucket.enumValues.includes(enumValue)) return bucket.id
  }
  return null
}
