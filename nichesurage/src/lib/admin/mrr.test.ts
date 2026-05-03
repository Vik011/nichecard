import { computeMrrEur } from './mrr'

describe('computeMrrEur', () => {
  it('returns 0 for an empty breakdown', () => {
    expect(computeMrrEur([])).toBe(0)
  })

  it('counts a single basic monthly sub at €9/mo', () => {
    expect(computeMrrEur([{ tier: 'basic', interval: 'monthly', count: 1 }])).toBe(9)
  })

  it('counts a single basic yearly sub at €7.50/mo (€90/12)', () => {
    expect(computeMrrEur([{ tier: 'basic', interval: 'yearly', count: 1 }])).toBe(7.5)
  })

  it('counts a single premium monthly sub at €19/mo', () => {
    expect(computeMrrEur([{ tier: 'premium', interval: 'monthly', count: 1 }])).toBe(19)
  })

  it('counts premium yearly at €15.83/mo (rounded to cents)', () => {
    // 190 / 12 = 15.8333... → rounded to 15.83
    expect(computeMrrEur([{ tier: 'premium', interval: 'yearly', count: 1 }])).toBe(15.83)
  })

  it('sums multiple buckets', () => {
    const out = computeMrrEur([
      { tier: 'basic', interval: 'monthly', count: 3 }, // 27
      { tier: 'basic', interval: 'yearly', count: 2 }, // 15
      { tier: 'premium', interval: 'monthly', count: 1 }, // 19
      { tier: 'premium', interval: 'yearly', count: 1 }, // 15.83
    ])
    // 27 + 15 + 19 + 15.83 = 76.83
    expect(out).toBe(76.83)
  })

  it('scales linearly with count', () => {
    expect(computeMrrEur([{ tier: 'basic', interval: 'monthly', count: 10 }])).toBe(90)
  })

  it('warns and skips unknown combos rather than crashing', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const out = computeMrrEur([
      { tier: 'basic', interval: 'monthly', count: 1 },
      // Bogus combo — type assertion to bypass TS; real input could come from
      // bad DB rows.
      { tier: 'mystery' as 'basic', interval: 'monthly', count: 5 },
    ])
    expect(out).toBe(9) // unknown bucket dropped
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
