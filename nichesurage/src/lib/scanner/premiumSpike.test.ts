// Jest tests for the premium spike classifier. The module itself lives
// alongside the Deno edge function (supabase/functions/_shared) because
// /scan imports it; we reach across via relative path so we get one
// authoritative implementation rather than a parallel src/ copy that
// could drift.
import {
  classifyVideoType,
  calculateVPS,
  detectSpikeMultiplier,
  isPremiumSpikeChannel,
  matchesContentFarmPattern,
  SHORTS_MAX_DURATION_S,
  LONGFORM_VPS_MIN,
  SHORTS_VPS_MIN,
  type PremiumSpikeChannelInput,
} from '../../../supabase/functions/_shared/premiumSpike'
import type { VideoData } from '../../../supabase/functions/_shared/types'

const NOW = new Date('2026-05-03T12:00:00.000Z')

function makeVideo(overrides: Partial<VideoData> = {}): VideoData {
  return {
    videoId: overrides.videoId ?? `vid-${Math.random().toString(36).slice(2, 8)}`,
    title: overrides.title ?? 'Test video',
    description: overrides.description ?? '',
    viewCount: overrides.viewCount ?? 0,
    likeCount: overrides.likeCount ?? 0,
    commentCount: overrides.commentCount ?? 0,
    publishedAt: overrides.publishedAt ?? NOW.toISOString(),
    durationSeconds: overrides.durationSeconds ?? 600, // default longform
  }
}

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
}

describe('classifyVideoType', () => {
  it('treats exactly 180s as shorts (boundary)', () => {
    expect(classifyVideoType(180)).toBe('shorts')
  })
  it('treats 181s as longform', () => {
    expect(classifyVideoType(181)).toBe('longform')
  })
  it('treats 0 (unknown) as shorts (defensive)', () => {
    expect(classifyVideoType(0)).toBe('shorts')
  })
  it('respects the SHORTS_MAX_DURATION_S constant', () => {
    expect(classifyVideoType(SHORTS_MAX_DURATION_S)).toBe('shorts')
    expect(classifyVideoType(SHORTS_MAX_DURATION_S + 1)).toBe('longform')
  })
})

describe('calculateVPS', () => {
  it('divides views by subs', () => {
    expect(calculateVPS(10_000, 1_000)).toBe(10)
  })
  it('clamps zero subs to 1 (no division by zero)', () => {
    expect(calculateVPS(500, 0)).toBe(500)
  })
  it('handles tiny denominators correctly', () => {
    expect(calculateVPS(1_000, 1)).toBe(1_000)
  })
})

describe('detectSpikeMultiplier', () => {
  it('returns 1.0 when older bucket is empty', () => {
    const recent = [makeVideo({ viewCount: 100_000 })]
    expect(detectSpikeMultiplier(recent, [], 1_000)).toBe(1)
  })
  it('returns 1.0 when recent bucket is empty', () => {
    const older = [makeVideo({ viewCount: 1_000 })]
    expect(detectSpikeMultiplier([], older, 1_000)).toBe(1)
  })
  it('returns 1.0 when older median is zero (all older have zero views)', () => {
    const recent = [makeVideo({ viewCount: 50_000 })]
    const older = [makeVideo({ viewCount: 0 }), makeVideo({ viewCount: 0 })]
    expect(detectSpikeMultiplier(recent, older, 1_000)).toBe(1)
  })
  it('computes recent_avg / older_median', () => {
    // recent VPS: [50, 30] avg=40. older VPS: [10, 5, 8] median=8. → 40/8 = 5.
    const recent = [makeVideo({ viewCount: 50_000 }), makeVideo({ viewCount: 30_000 })]
    const older = [
      makeVideo({ viewCount: 10_000 }),
      makeVideo({ viewCount: 5_000 }),
      makeVideo({ viewCount: 8_000 }),
    ]
    expect(detectSpikeMultiplier(recent, older, 1_000)).toBeCloseTo(5, 5)
  })
  it('uses true median for an even-sized older bucket', () => {
    // older VPS: [4, 6] median = 5. recent avg = 10. → 2x.
    const recent = [makeVideo({ viewCount: 10_000 })]
    const older = [makeVideo({ viewCount: 4_000 }), makeVideo({ viewCount: 6_000 })]
    expect(detectSpikeMultiplier(recent, older, 1_000)).toBeCloseTo(2, 5)
  })
})

describe('isPremiumSpikeChannel — LONGFORM', () => {
  const baseChannel: PremiumSpikeChannelInput = { contentType: 'longform', subscriberCount: 1_500 }

  function lf(views: number, daysOld: number, durationSeconds = 600): VideoData {
    return makeVideo({ viewCount: views, publishedAt: daysAgo(daysOld), durationSeconds })
  }

  it('rejects when subs below LONGFORM_SUBS_MIN', () => {
    const r = isPremiumSpikeChannel({ ...baseChannel, subscriberCount: 500 }, [], NOW)
    expect(r.isPremium).toBe(false)
    expect(r.reason).toMatch(/^subs_too_low/)
  })

  it('rejects when fewer than QUALIFY_WINDOW longform videos in pool', () => {
    const videos = [lf(50_000, 1), lf(30_000, 5)] // only 2 longform, need 3
    const r = isPremiumSpikeChannel(baseChannel, videos, NOW)
    expect(r.isPremium).toBe(false)
    expect(r.reason).toMatch(/^insufficient_videos/)
  })

  it('rejects when only 1 of 3 qualifying-window videos hits thresholds', () => {
    const videos = [
      lf(50_000, 1),  // hit
      lf(2_000, 3),   // miss views floor
      lf(5_000, 5),   // miss views floor
      lf(2_000, 7),   // older bucket
      lf(1_000, 9),
    ]
    const r = isPremiumSpikeChannel(baseChannel, videos, NOW)
    expect(r.isPremium).toBe(false)
    expect(r.reason).toMatch(/^below_qualify_threshold/)
  })

  it('passes 2/3 qualifying with strong spike', () => {
    // qualifying-window VPS: [50, 30, 5], 2 of 3 ≥ 10. older VPS: [3, 2] median=2.5.
    // recent avg = (50+30+5)/3 ≈ 28.3 → spike ≈ 11.3x (well above min 3x)
    const videos = [
      lf(75_000, 1),
      lf(45_000, 4),
      lf(7_500, 7),
      lf(4_500, 14),
      lf(3_000, 21),
    ]
    const r = isPremiumSpikeChannel(baseChannel, videos, NOW)
    expect(r.isPremium).toBe(true)
    expect(r.reason).toBe('premium')
    expect(r.score).toBeGreaterThanOrEqual(60)
    expect(r.qualifyingVideoCount).toBe(2)
  })

  it('rejects when qualify count passes but spike is weak (recent baseline same as older)', () => {
    // qualifying-window VPS: [11, 11, 11] (all hit min 10 + ≥ 10k views).
    // older VPS: [10.5, 10.5] median=10.5 → spike ≈ 11/10.5 ≈ 1.05x (< 3x)
    const videos = [
      lf(16_500, 1),
      lf(16_500, 4),
      lf(16_500, 7),
      lf(15_750, 14),
      lf(15_750, 21),
    ]
    const r = isPremiumSpikeChannel(baseChannel, videos, NOW)
    expect(r.isPremium).toBe(false)
    expect(r.reason).toMatch(/^no_spike/)
  })

  it('filters out non-longform videos before pool selection', () => {
    // 4 shorts + 2 longform → only 2 longform in pool, < QUALIFY_WINDOW=3.
    const videos = [
      lf(80_000, 1, 60),  // SHORT — should be ignored
      lf(80_000, 1, 90),  // SHORT — should be ignored
      lf(80_000, 1, 120), // SHORT — should be ignored
      lf(80_000, 1, 150), // SHORT — should be ignored
      lf(80_000, 2, 600),  // longform
      lf(80_000, 5, 700),  // longform
    ]
    const r = isPremiumSpikeChannel(baseChannel, videos, NOW)
    expect(r.reason).toMatch(/^insufficient_videos/)
  })

  it('awards bonus score for full sweep + strong spike + strong VPS', () => {
    // 3/3 hits, all VPS ~50 (≥ 2×LONGFORM_VPS_MIN=20), recent vs older spike ~12x.
    const videos = [
      lf(75_000, 1),
      lf(75_000, 4),
      lf(75_000, 7),
      lf(6_000, 14),  // VPS 4
      lf(7_500, 21),  // VPS 5
    ]
    const r = isPremiumSpikeChannel(baseChannel, videos, NOW)
    expect(r.isPremium).toBe(true)
    expect(r.score).toBeGreaterThanOrEqual(90) // base 60 + full sweep 10 + bonus spike 20 + strong VPS 10
  })

  it('reports vpsRecentAvg, vpsOlderMedian, and spikeMultiplier in result', () => {
    const videos = [
      lf(75_000, 1),
      lf(45_000, 4),
      lf(7_500, 7),
      lf(4_500, 14),
      lf(3_000, 21),
    ]
    const r = isPremiumSpikeChannel(baseChannel, videos, NOW)
    expect(r.vpsRecentAvg).toBeGreaterThan(0)
    expect(r.vpsOlderMedian).toBeGreaterThan(0)
    expect(r.spikeMultiplier).toBeGreaterThanOrEqual(3)
  })

  it('honors LONGFORM_VPS_MIN — 1k-sub channel with 9k views fails VPS gate', () => {
    // 1k-sub channel * VPS 10 = 10k views. 9k views = VPS 9 < min 10.
    const videos = [
      lf(15_000, 1),
      lf(9_000, 4),
      lf(9_000, 7),
      lf(2_000, 14),
      lf(1_000, 21),
    ]
    const r = isPremiumSpikeChannel(baseChannel, videos, NOW)
    expect(r.isPremium).toBe(false)
    expect(r.reason).toMatch(/^below_qualify_threshold/)
    // sanity: LONGFORM_VPS_MIN is the constant we're testing against
    expect(LONGFORM_VPS_MIN).toBe(10)
  })
})

describe('isPremiumSpikeChannel — SHORTS', () => {
  const baseChannel: PremiumSpikeChannelInput = { contentType: 'shorts', subscriberCount: 200 }

  function sh(views: number, daysOld: number, durationSeconds = 60): VideoData {
    return makeVideo({ viewCount: views, publishedAt: daysAgo(daysOld), durationSeconds })
  }

  it('rejects when subs below SHORTS_SUBS_MIN', () => {
    const r = isPremiumSpikeChannel({ ...baseChannel, subscriberCount: 50 }, [], NOW)
    expect(r.reason).toMatch(/^subs_too_low/)
  })

  it('passes 3/5 qualifying with 5x spike', () => {
    // 200-sub channel, VPS_MIN=1000 → need ≥ 200k views per qualifying short.
    // Older bucket VPS ~50 → median 50; recent avg VPS ~1100 → ~22x spike.
    const videos = [
      sh(220_000, 1),  // VPS 1100, hit
      sh(220_000, 3),  // hit
      sh(220_000, 5),  // hit
      sh(50_000, 7),   // miss views floor (need 30k actually, but VPS 250 < 1000) — actually 50k > 30k, but VPS 250 < 1000
      sh(40_000, 9),
      sh(8_000, 14),   // older
      sh(12_000, 18),
    ]
    const r = isPremiumSpikeChannel(baseChannel, videos, NOW)
    expect(r.isPremium).toBe(true)
    expect(r.qualifyingVideoCount).toBe(3)
  })

  it('rejects when only 2 of 5 qualifying-window shorts hit thresholds', () => {
    const videos = [
      sh(220_000, 1),  // hit
      sh(220_000, 3),  // hit
      sh(50_000, 5),   // miss VPS (250 < 1000)
      sh(40_000, 7),
      sh(30_000, 9),
      sh(10_000, 14),
      sh(12_000, 18),
    ]
    const r = isPremiumSpikeChannel(baseChannel, videos, NOW)
    expect(r.isPremium).toBe(false)
    expect(r.reason).toMatch(/^below_qualify_threshold/)
  })

  it('honors SHORTS_VPS_MIN constant', () => {
    expect(SHORTS_VPS_MIN).toBe(1000)
  })

  it('filters out longform videos before pool selection (shorts channel)', () => {
    // 5 longform uploads + 4 shorts. Pool = 4 shorts. QUALIFY_WINDOW=5 → insufficient.
    const videos = [
      sh(220_000, 1, 60),
      sh(220_000, 3, 60),
      sh(220_000, 5, 60),
      sh(220_000, 7, 60),
      makeVideo({ viewCount: 220_000, publishedAt: daysAgo(1), durationSeconds: 600 }),
      makeVideo({ viewCount: 220_000, publishedAt: daysAgo(3), durationSeconds: 700 }),
      makeVideo({ viewCount: 220_000, publishedAt: daysAgo(5), durationSeconds: 800 }),
    ]
    const r = isPremiumSpikeChannel(baseChannel, videos, NOW)
    expect(r.reason).toMatch(/^insufficient_videos/)
  })
})

describe('isPremiumSpikeChannel — recency window', () => {
  it('drops longform videos older than POOL_DAYS', () => {
    // 5 strong longform videos but all ≥60 days old → outside 45-day window.
    const channel: PremiumSpikeChannelInput = { contentType: 'longform', subscriberCount: 1_500 }
    const old = (n: number) => makeVideo({
      viewCount: 75_000,
      publishedAt: daysAgo(60 + n),
      durationSeconds: 600,
    })
    const r = isPremiumSpikeChannel(channel, [old(0), old(2), old(4), old(6), old(8)], NOW)
    expect(r.reason).toMatch(/^insufficient_videos/)
  })
})

describe('matchesContentFarmPattern', () => {
  it('matches breastfeeding-positions content-farm pattern', () => {
    expect(matchesContentFarmPattern('Best Breastfeeding Positions for New Mothers')).toBe(true)
    expect(matchesContentFarmPattern('Breastfeeding Vlogs / Mom And Baby In The Bedroom')).toBe(true)
    expect(matchesContentFarmPattern('Mom and Baby Breastfeeding 2026')).toBe(true)
  })

  it('does NOT match clinical/educational lactation content (no exploit pattern)', () => {
    // We want to keep real lactation educators — only the exploit pattern is blacklisted.
    expect(matchesContentFarmPattern('Lactation Consultant Q&A: Common Concerns')).toBe(false)
    expect(matchesContentFarmPattern('How to Increase Milk Supply Naturally')).toBe(false)
  })

  it('matches reaction / clip aggregator titles', () => {
    expect(matchesContentFarmPattern('Funny Reaction Compilation')).toBe(true)
    expect(matchesContentFarmPattern('Best Fail Moments 2026')).toBe(true)
    expect(matchesContentFarmPattern('Funniest Win Compilation')).toBe(true)
    expect(matchesContentFarmPattern('TikTok Compilation #5')).toBe(true)
    expect(matchesContentFarmPattern('Shorts Compilation Best Of')).toBe(true)
    expect(matchesContentFarmPattern('Clip Compilation Highlights')).toBe(true)
  })

  it('matches ASMR / satisfying farms', () => {
    expect(matchesContentFarmPattern('ASMR Eating Show')).toBe(true)
    expect(matchesContentFarmPattern('Satisfying Compilation #12')).toBe(true)
  })

  it('matches "Funniest 50 Moments" celebrity-clip aggregators', () => {
    expect(matchesContentFarmPattern('Funniest 50 Moments of LeBron')).toBe(true)
    expect(matchesContentFarmPattern('Top 100 Moments of 2026')).toBe(true)
  })

  it('does NOT match legitimate creator titles', () => {
    expect(matchesContentFarmPattern('How to Build an AI Automation Agency')).toBe(false)
    expect(matchesContentFarmPattern('Dark History of Highway 101')).toBe(false)
    expect(matchesContentFarmPattern('Costco Deals You NEED To Buy Right Now')).toBe(false)
    expect(matchesContentFarmPattern('Things I Wish I Knew Before Starting KDP')).toBe(false)
    expect(matchesContentFarmPattern('Deconstructing a Full Track from Scratch')).toBe(false)
  })

  it('handles empty / null titles defensively', () => {
    expect(matchesContentFarmPattern('')).toBe(false)
  })
})

describe('isPremiumSpikeChannel — content-farm rejection', () => {
  it('rejects an otherwise-premium channel whose qualifying videos match the blacklist', () => {
    // Channel passes EVERY numeric gate (subs, VPS, qualify, spike) but
    // qualifying titles match the breastfeeding-tutorial farm pattern.
    const channel: PremiumSpikeChannelInput = { contentType: 'longform', subscriberCount: 6_000 }
    const exploit = (views: number, daysOld: number, title: string): VideoData => makeVideo({
      viewCount: views,
      publishedAt: daysAgo(daysOld),
      durationSeconds: 600,
      title,
    })
    const r = isPremiumSpikeChannel(channel, [
      exploit(260_000, 1, 'Best Breastfeeding Positions for New Mothers'),
      exploit(200_000, 4, 'New Moms Guide to Breastfeeding Easy Tips'),
      exploit(80_000, 7, 'How to Breastfeed Correctly No Pain'),
      exploit(15_000, 14, 'Breastfeeding Vlogs Mom and Baby Bedroom'),
      exploit(12_000, 21, 'Mom and Baby Breastfeeding Routine'),
    ], NOW)
    expect(r.isPremium).toBe(false)
    expect(r.reason).toMatch(/^content_farm_title/)
  })

  it('still flags premium for legitimate niche channels with strong videos', () => {
    // Same numeric profile, but titles are legitimate niche content.
    const channel: PremiumSpikeChannelInput = { contentType: 'longform', subscriberCount: 6_000 }
    const legit = (views: number, daysOld: number, title: string): VideoData => makeVideo({
      viewCount: views,
      publishedAt: daysAgo(daysOld),
      durationSeconds: 600,
      title,
    })
    const r = isPremiumSpikeChannel(channel, [
      legit(260_000, 1, 'How I Built an AI Automation Agency in 30 Days'),
      legit(200_000, 4, 'My First $10k from n8n Workflows'),
      legit(80_000, 7, 'Claude Code Tutorial: Real Project Walkthrough'),
      legit(15_000, 14, 'Behind the Scenes: Client Project'),
      legit(12_000, 21, 'Old vlog with weak title'),
    ], NOW)
    expect(r.isPremium).toBe(true)
    expect(r.reason).toBe('premium')
  })
})
