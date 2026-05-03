import type { SearchFilters, ChannelAge, ContentType, SortBy } from '@/lib/types'

const VALID_CHANNEL_AGES: ChannelAge[] = ['1month', '3months', '6months', '1year', 'any']
const VALID_SORTS: SortBy[] = ['score', 'newest']

export interface ReadableParams {
  get(name: string): string | null
  has(name: string): boolean
}

export interface FilterDefaults {
  subscriberMin: number
  subscriberMax: number
}

export function filtersToParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams()
  params.set('subscriberMin', String(filters.subscriberMin))
  params.set('subscriberMax', String(filters.subscriberMax))
  params.set('channelAge', filters.channelAge)
  params.set('viral', String(filters.onlyRecentlyViral))
  params.set('sortBy', filters.sortBy)
  return params
}

export function paramsToFilters(
  params: ReadableParams,
  contentType: ContentType,
  defaults: FilterDefaults,
): SearchFilters {
  const channelAge = params.get('channelAge')
  const sortBy = params.get('sortBy')
  return {
    contentType,
    subscriberMin: params.has('subscriberMin')
      ? Number(params.get('subscriberMin'))
      : defaults.subscriberMin,
    subscriberMax: params.has('subscriberMax')
      ? Number(params.get('subscriberMax'))
      : defaults.subscriberMax,
    channelAge: VALID_CHANNEL_AGES.includes(channelAge as ChannelAge)
      ? (channelAge as ChannelAge)
      : 'any',
    onlyRecentlyViral: params.get('viral') === 'true',
    sortBy: VALID_SORTS.includes(sortBy as SortBy) ? (sortBy as SortBy) : 'score',
  }
}
