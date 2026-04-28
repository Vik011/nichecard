import { toSubscriberRange } from './queries'

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
