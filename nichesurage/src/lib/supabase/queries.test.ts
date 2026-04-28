import { toSubscriberRange, mapRow } from './queries'
import type { DbScanResult } from '@/lib/types/database'

describe('toSubscriberRange', () => {
  it.each<[number, string]>([
    [0,       '<1K'],
    [500,     '<1K'],
    [999,     '<1K'],
    [1000,    '1K–5K'],
    [4999,    '1K–5K'],
    [5000,    '5K–10K'],
    [9999,    '5K–10K'],
    [10000,   '10K–50K'],
    [49999,   '10K–50K'],
    [50000,   '50K–100K'],
    [99999,   '50K–100K'],
    [100000,  '100K–500K'],
    [499999,  '100K–500K'],
    [500000,  '500K+'],
    [1000000, '500K+'],
  ])('count %i → %s', (count, expected) => {
    expect(toSubscriberRange(count)).toBe(expected)
  })
})

const baseRow: DbScanResult = {
  id: 'abc',
  youtube_channel_id: 'yt1',
  channel_name: 'Test Channel',
  niche_label: 'Finance',
  channel_url: 'https://youtube.com/c/test',
  channel_created_at: '2023-01-01',
  video_count: 50,
  subscriber_count: 7500,
  views_48h: 10000,
  views_avg: 5000,
  spike_multiplier: 4.2,
  engagement_rate: 5.1,
  opportunity_score: 80,
  virality_rating: 'excellent',
  language: 'en',
  content_type: 'shorts',
  hook_score: null,
  avg_view_duration_pct: null,
  search_volume: null,
  competition_score: null,
  scanned_at: '2026-04-28T10:00:00Z',
}

describe('mapRow', () => {
  it('maps a shorts row to ShortsNicheCardData', () => {
    const row = { ...baseRow, content_type: 'shorts' as const, hook_score: 88, avg_view_duration_pct: 72 }
    const result = mapRow(row)
    expect(result.contentType).toBe('shorts')
    expect(result.subscriberRange).toBe('5K–10K')
    expect(result.id).toBe('abc')
    expect(result.channelName).toBe('Test Channel')
    if (result.contentType === 'shorts') {
      expect(result.hookScore).toBe(88)
      expect(result.avgViewDurationPct).toBe(72)
    }
  })

  it('maps a longform row to LongformNicheCardData', () => {
    const row = { ...baseRow, content_type: 'longform' as const, search_volume: 40000, competition_score: 25 }
    const result = mapRow(row)
    expect(result.contentType).toBe('longform')
    expect(result.subscriberRange).toBe('5K–10K')
    if (result.contentType === 'longform') {
      expect(result.searchVolume).toBe(40000)
      expect(result.competitionScore).toBe(25)
      expect(result.avgViewsPerVideo).toBe(5000)
    }
  })

  it('maps null type-specific fields to undefined', () => {
    const row = { ...baseRow, content_type: 'shorts' as const }
    const result = mapRow(row)
    if (result.contentType === 'shorts') {
      expect(result.hookScore).toBeUndefined()
      expect(result.avgViewDurationPct).toBeUndefined()
    }
  })
})
