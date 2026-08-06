import { redactRow, redactFeed } from './redact'
import type { NicheCardData } from '@/lib/types'

// Distinctive identity tokens so "no identity in JSON" assertions are robust.
function makeRow(over: Partial<NicheCardData> = {}): NicheCardData {
  return {
    id: 'sr-uuid-1',
    youtubeChannelId: 'UCidentityAAA',
    contentType: 'shorts',
    channelCreatedAt: '2023-01-01',
    videoCount: 50,
    subscriberCount: 7500,
    subscriberRange: '5K–10K',
    spikeMultiplier: 4,
    opportunityScore: 80,
    viralityRating: 'excellent',
    language: 'en',
    channelName: 'RealChannelAAA',
    nicheLabel: 'Crypto Secrets Niche',
    channelUrl: 'https://youtube.com/channel/UCidentityAAA',
    seedKeyword: 'crypto secrets',
    outlierVideoTitle: 'How I made a million dollars',
    outlierVideoViews: 999999,
    clusterId: 'cluster-AAA',
    clusterLabel: 'Crypto Cluster',
    momentumVideoId: 'video-AAA',
    ...over,
  } as NicheCardData
}

describe('redactRow', () => {
  it('returns the row UNCHANGED when revealed', () => {
    const row = makeRow()
    expect(redactRow(row, true)).toBe(row)
  })

  it('blanks all identity fields for a locked scan row, keeps safe metrics', () => {
    const r = redactRow(makeRow(), false)
    // identity gone
    expect(r.youtubeChannelId).toBe('')
    expect(r.channelUrl).toBeUndefined()
    expect(r.channelName).toMatch(/^Hidden Channel #\d{3}$/)
    expect(r.nicheLabel).toBe('Faceless Shorts')
    expect(r.clusterId).toBeUndefined()
    expect(r.clusterLabel).toBeUndefined()
    expect(r.seedKeyword).toBeUndefined()
    expect(r.outlierVideoTitle).toBeUndefined()
    expect(r.outlierVideoViews).toBeUndefined()
    expect(r.momentumVideoId).toBeUndefined()
    expect(r.channelCreatedAt).toBe('')
    // exact subscriber count dropped (fingerprint), band preserved
    expect(r.subscriberCount).toBe(0)
    expect(r.subscriberRange).toBe('5K–10K')
    // opaque scan id preserved (it's a UUID, not identity); safe metrics kept
    expect(r.id).toBe('sr-uuid-1')
    expect(r.opportunityScore).toBe(80)
    expect(r.contentType).toBe('shorts')
    expect(r.language).toBe('en')
  })

  it('drops exact subscriberCount to 0 for locked rows, keeps the band', () => {
    const r = redactRow(makeRow({ subscriberCount: 73412, subscriberRange: '50K–100K' }), false)
    expect(r.subscriberCount).toBe(0)
    expect(r.subscriberRange).toBe('50K–100K')
  })

  it('keeps exact subscriberCount for revealed rows', () => {
    const r = redactRow(makeRow({ subscriberCount: 73412 }), true)
    expect(r.subscriberCount).toBe(73412)
  })

  it('masks the wl: catalog id so the real youtube_channel_id never leaks', () => {
    const r = redactRow(
      makeRow({ id: 'wl:UCcatalogBBB', youtubeChannelId: 'UCcatalogBBB', channelName: 'CatalogChanBBB' }),
      false,
    )
    expect(r.id).not.toBe('wl:UCcatalogBBB')
    expect(r.id.startsWith('wl:hidden:')).toBe(true)
    expect(r.id).not.toContain('UCcatalogBBB')
    expect(r.youtubeChannelId).toBe('')
    expect(JSON.stringify(r)).not.toContain('UCcatalogBBB')
  })

  it('Hidden Channel # label is stable per id', () => {
    const a = redactRow(makeRow({ id: 'stable-1' }), false)
    const b = redactRow(makeRow({ id: 'stable-1' }), false)
    expect(a.channelName).toBe(b.channelName)
  })
})

describe('redactFeed — tier entitlement', () => {
  it('Free: only the daily pin is full, all others redacted', () => {
    const rows = [
      makeRow({ id: 'a', youtubeChannelId: 'UCa', channelName: 'AlphaChan' }),
      makeRow({ id: 'pin', youtubeChannelId: 'UCpin', channelName: 'PinChan' }),
      makeRow({ id: 'c', youtubeChannelId: 'UCc', channelName: 'GammaChan' }),
    ]
    const { data, revealedIds } = redactFeed(rows, { tier: 'free', todayPinId: 'pin' })
    expect(revealedIds).toEqual(['pin'])
    const byId = Object.fromEntries(data.map((r) => [r.id, r]))
    expect(byId['pin'].channelName).toBe('PinChan')
    expect(byId['pin'].youtubeChannelId).toBe('UCpin')
    expect(byId['a'].channelName).toMatch(/^Hidden Channel #/)
    expect(byId['a'].youtubeChannelId).toBe('')
    expect(byId['c'].youtubeChannelId).toBe('')
  })

  it('Free with no pin: everything redacted', () => {
    const rows = [makeRow({ id: 'a' }), makeRow({ id: 'b' })]
    const { data, revealedIds } = redactFeed(rows, { tier: 'free', todayPinId: null })
    expect(revealedIds).toEqual([])
    expect(data.every((r) => r.youtubeChannelId === '')).toBe(true)
  })

  it('Basic: top 5 by order full, the rest redacted', () => {
    const rows = Array.from({ length: 7 }, (_, i) =>
      makeRow({ id: `r${i}`, youtubeChannelId: `UC${i}`, channelName: `Chan${i}` }),
    )
    const { data } = redactFeed(rows, { tier: 'basic', todayPinId: null })
    data.slice(0, 5).forEach((r, i) => {
      expect(r.youtubeChannelId).toBe(`UC${i}`)
      expect(r.channelName).toBe(`Chan${i}`)
    })
    data.slice(5).forEach((r) => {
      expect(r.youtubeChannelId).toBe('')
      expect(r.channelName).toMatch(/^Hidden Channel #/)
    })
  })

  it('Premium: every row full', () => {
    const rows = Array.from({ length: 8 }, (_, i) => makeRow({ id: `r${i}`, youtubeChannelId: `UC${i}` }))
    const { data, revealedIds } = redactFeed(rows, { tier: 'premium', todayPinId: null })
    expect(revealedIds.length).toBe(8)
    expect(data.every((r, i) => r.youtubeChannelId === `UC${i}`)).toBe(true)
  })

  it('Free locked rows leak NO identity tokens in serialized JSON', () => {
    const rows = [
      makeRow({ id: 'pin', youtubeChannelId: 'UCpin', channelName: 'PinChan', nicheLabel: 'PinNiche' }),
      makeRow({
        id: 'locked',
        youtubeChannelId: 'UClockedZZZ',
        channelName: 'SecretChannelZZZ',
        nicheLabel: 'SecretNicheZZZ',
        channelUrl: 'https://youtube.com/channel/UClockedZZZ',
        seedKeyword: 'secret keyword zzz',
        outlierVideoTitle: 'Secret Video Title ZZZ',
        subscriberCount: 880123,
      }),
      makeRow({ id: 'wl:UCcatZZZ', youtubeChannelId: 'UCcatZZZ', channelName: 'CatalogZZZ' }),
    ]
    const { data } = redactFeed(rows, { tier: 'free', todayPinId: 'pin' })
    const json = JSON.stringify(data)
    // pin identity is allowed
    expect(json).toContain('UCpin')
    // locked identity must be absent
    expect(json).not.toContain('UClockedZZZ')
    expect(json).not.toContain('SecretChannelZZZ')
    expect(json).not.toContain('SecretNicheZZZ')
    expect(json).not.toContain('secret keyword zzz')
    expect(json).not.toContain('Secret Video Title ZZZ')
    expect(json).not.toContain('UCcatZZZ')
    // exact subscriber count of the locked row must not leak
    expect(json).not.toContain('880123')
  })
})
