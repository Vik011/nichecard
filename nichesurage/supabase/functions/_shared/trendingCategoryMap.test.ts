// supabase/functions/_shared/trendingCategoryMap.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  TRENDING_CATEGORY_MAP,
  resolveCategoryEnum,
  TRENDING_REGIONS,
} from './trendingCategoryMap.ts'

Deno.test('TRENDING_CATEGORY_MAP: covers expected YouTube category IDs', () => {
  const ids = Object.keys(TRENDING_CATEGORY_MAP).sort()
  assertEquals(ids, ['17', '20', '22', '24', '25', '26', '27', '28'])
})

Deno.test('TRENDING_CATEGORY_MAP: every entry has bucketId + categoryEnum', () => {
  for (const [_, entry] of Object.entries(TRENDING_CATEGORY_MAP)) {
    assertEquals(typeof entry.bucketId, 'string')
    assertEquals(typeof entry.categoryEnum, 'string')
  }
})

Deno.test('resolveCategoryEnum: 28 (Science & Tech) → ai_tools', () => {
  assertEquals(resolveCategoryEnum('28'), 'ai_tools')
})

Deno.test('resolveCategoryEnum: 20 (Gaming) → gaming_streamers', () => {
  assertEquals(resolveCategoryEnum('20'), 'gaming_streamers')
})

Deno.test('resolveCategoryEnum: 17 (Sports) → fitness_health', () => {
  assertEquals(resolveCategoryEnum('17'), 'fitness_health')
})

Deno.test('resolveCategoryEnum: unknown id → null', () => {
  assertEquals(resolveCategoryEnum('999'), null)
})

Deno.test('TRENDING_REGIONS: includes US, DE, GB', () => {
  assertEquals(TRENDING_REGIONS, ['US', 'DE', 'GB'])
})
