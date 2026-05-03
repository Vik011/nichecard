jest.mock('@/lib/anthropic/client', () => ({
  anthropic: { messages: { create: jest.fn() } },
}))

import { parseAngles, AnglesParseError } from './generate'

const validAngles = JSON.stringify([
  { title: 'How tiny channels go viral with this exact format', hook: 'Most small channels die in the first 90 days.', format: 'shorts', why: 'Spike pattern shows new entrants outperforming legacy creators.' },
  { title: 'The 3-second rule that doubled retention', hook: 'You have three seconds before they swipe.', format: 'shorts', why: 'High spike multiplier rewards aggressive hooks.' },
  { title: 'I copied this niche playbook for 30 days', hook: 'Here is what actually moved the needle.', format: 'shorts', why: 'Opportunity score above 60 signals replicable wins.' },
  { title: 'Why this audience watches shorts on repeat', hook: 'They watch the same Short fifty times.', format: 'shorts', why: 'High engagement suggests rewatchable format.' },
  { title: 'Build a 100k channel in this exact niche', hook: 'Pick the boring niche, win the boring war.', format: 'shorts', why: 'Subscriber range proves room above current ceiling.' },
])

describe('parseAngles', () => {
  it('parses a clean JSON array of 5 angles', () => {
    const result = parseAngles(validAngles, 'shorts')
    expect(result).toHaveLength(5)
    expect(result[0].title).toMatch(/tiny channels/)
    expect(result[0].format).toBe('shorts')
  })

  it('strips ```json fences before parsing', () => {
    const fenced = '```json\n' + validAngles + '\n```'
    expect(parseAngles(fenced, 'shorts')).toHaveLength(5)
  })

  it('strips bare ``` fences', () => {
    const fenced = '```\n' + validAngles + '\n```'
    expect(parseAngles(fenced, 'shorts')).toHaveLength(5)
  })

  it('coerces format to expected when model returns the wrong one', () => {
    const angles = JSON.parse(validAngles).map((a: { format: string }) => ({ ...a, format: 'longform' }))
    const result = parseAngles(JSON.stringify(angles), 'shorts')
    expect(result.every(a => a.format === 'shorts')).toBe(true)
  })

  it('throws AnglesParseError on invalid JSON', () => {
    expect(() => parseAngles('not json at all', 'shorts')).toThrow(AnglesParseError)
  })

  it('throws when array length is wrong', () => {
    const four = JSON.parse(validAngles).slice(0, 4)
    expect(() => parseAngles(JSON.stringify(four), 'shorts')).toThrow(/5-element array/)
  })

  it('throws when an angle is missing a required field', () => {
    const broken = JSON.parse(validAngles)
    delete broken[2].hook
    expect(() => parseAngles(JSON.stringify(broken), 'shorts')).toThrow(/missing or invalid hook/)
  })

  it('throws when format is not shorts or longform', () => {
    const broken = JSON.parse(validAngles)
    broken[0].format = 'verticals'
    expect(() => parseAngles(JSON.stringify(broken), 'shorts')).toThrow(/format must be/)
  })
})
