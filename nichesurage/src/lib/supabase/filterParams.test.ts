import { filtersToParams, paramsToFilters } from './filterParams'
import type { SearchFilters } from '@/lib/types'

const SHORTS_DEFAULTS = { subscriberMin: 1000, subscriberMax: 100000 }
const LONGFORM_DEFAULTS = { subscriberMin: 1000, subscriberMax: 500000 }

const BASE_FILTERS: SearchFilters = {
  contentType: 'shorts',
  subscriberMin: 1000,
  subscriberMax: 100000,
  channelAge: 'any',
  onlyRecentlyViral: false,
}

describe('filtersToParams', () => {
  it('serializes subscriberMin, subscriberMax, channelAge, viral', () => {
    const params = filtersToParams(BASE_FILTERS)
    expect(params.get('subscriberMin')).toBe('1000')
    expect(params.get('subscriberMax')).toBe('100000')
    expect(params.get('channelAge')).toBe('any')
    expect(params.get('viral')).toBe('false')
  })

  it('does not include contentType in output', () => {
    const params = filtersToParams(BASE_FILTERS)
    expect(params.has('contentType')).toBe(false)
  })

  it('serializes viral=true', () => {
    const params = filtersToParams({ ...BASE_FILTERS, onlyRecentlyViral: true })
    expect(params.get('viral')).toBe('true')
  })
})

describe('paramsToFilters', () => {
  it('roundtrip: paramsToFilters(filtersToParams(filters)) returns identical object', () => {
    const params = filtersToParams(BASE_FILTERS)
    const result = paramsToFilters(params, 'shorts', SHORTS_DEFAULTS)
    expect(result).toEqual(BASE_FILTERS)
  })

  it('uses provided contentType argument, not from params', () => {
    const params = filtersToParams(BASE_FILTERS)
    const result = paramsToFilters(params, 'longform', LONGFORM_DEFAULTS)
    expect(result.contentType).toBe('longform')
  })

  it('falls back to defaults when params are empty', () => {
    const params = new URLSearchParams()
    const result = paramsToFilters(params, 'shorts', SHORTS_DEFAULTS)
    expect(result).toEqual({
      contentType: 'shorts',
      subscriberMin: 1000,
      subscriberMax: 100000,
      channelAge: 'any',
      onlyRecentlyViral: false,
    })
  })

  it('falls back to any when channelAge is invalid', () => {
    const params = new URLSearchParams({
      subscriberMin: '5000',
      subscriberMax: '200000',
      channelAge: 'invalid',
      viral: 'false',
    })
    const result = paramsToFilters(params, 'shorts', SHORTS_DEFAULTS)
    expect(result.channelAge).toBe('any')
  })

  it('parses viral=false as false (not falsy coercion)', () => {
    const params = new URLSearchParams({
      subscriberMin: '1000',
      subscriberMax: '100000',
      channelAge: 'any',
      viral: 'false',
    })
    const result = paramsToFilters(params, 'shorts', SHORTS_DEFAULTS)
    expect(result.onlyRecentlyViral).toBe(false)
  })

  it('parses viral=true as true', () => {
    const params = new URLSearchParams({
      subscriberMin: '1000',
      subscriberMax: '100000',
      channelAge: 'any',
      viral: 'true',
    })
    const result = paramsToFilters(params, 'shorts', SHORTS_DEFAULTS)
    expect(result.onlyRecentlyViral).toBe(true)
  })
})
