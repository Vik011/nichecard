/* eslint-disable @typescript-eslint/no-unused-vars -- mock query builders ignore their args */
import { preWarmDemoNiche } from './preWarm'

const generateVerdictMock = jest.fn()
const generateAnglesMock = jest.fn()

jest.mock('@/lib/health-check/verdict', () => ({
  generateVerdict: (...args: unknown[]) => generateVerdictMock(...args),
}))
jest.mock('@/lib/content-angles/generate', () => {
  // Re-export AnglesParseError so the helper's `instanceof` branch still works.
  class AnglesParseError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'AnglesParseError'
    }
  }
  return {
    generateAngles: (...args: unknown[]) => generateAnglesMock(...args),
    AnglesParseError,
  }
})

interface ScanRow {
  id: string
  niche_label: string
  channel_name: string
  language: string | null
  content_type: 'shorts' | 'longform'
  spike_multiplier: number | null
  opportunity_score: number | null
  engagement_rate: number | null
  virality_rating: 'excellent' | 'good' | 'average' | null
  subscriber_count: number | null
  views_48h: number | null
}

const SAMPLE_SCAN: ScanRow = {
  id: 'scan-1',
  niche_label: 'Faceless AI Channel Wealth',
  channel_name: 'AIWealth',
  language: 'en',
  content_type: 'shorts',
  spike_multiplier: 5.2,
  opportunity_score: 78,
  engagement_rate: 0.082,
  virality_rating: 'good',
  subscriber_count: 4200,
  views_48h: 15000,
}

interface MockState {
  scan: ScanRow | null
  scanError?: { message: string }
  healthCacheRow: { expires_at: string } | null
  anglesCacheRow: { expires_at: string } | null
  healthUpserts: Array<Record<string, unknown>>
  anglesUpserts: Array<Record<string, unknown>>
  healthUpsertError?: { message: string }
  anglesUpsertError?: { message: string }
}

function makeServiceClient(state: MockState) {
  return {
    from(table: string) {
      if (table === 'scan_results') return makeScanBuilder(state)
      if (table === 'niche_health_checks') return makeHealthBuilder(state)
      if (table === 'content_angles_cache') return makeAnglesBuilder(state)
      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

function makeScanBuilder(state: MockState) {
  return {
    select(_cols: string) {
      const builder = {
        eq(_col: string, _value: string) {
          return builder
        },
        async maybeSingle() {
          if (state.scanError) return { data: null, error: state.scanError }
          return { data: state.scan, error: null }
        },
      }
      return builder
    },
  }
}

function makeHealthBuilder(state: MockState) {
  return {
    select(_cols: string) {
      const builder = {
        eq(_col: string, _value: string) {
          return builder
        },
        gt(_col: string, _value: string) {
          return builder
        },
        async maybeSingle() {
          return { data: state.healthCacheRow, error: null }
        },
      }
      return builder
    },
    async upsert(row: Record<string, unknown>, _opts: unknown) {
      if (state.healthUpsertError) return { error: state.healthUpsertError }
      state.healthUpserts.push(row)
      return { error: null }
    },
  }
}

function makeAnglesBuilder(state: MockState) {
  return {
    select(_cols: string) {
      const builder = {
        eq(_col: string, _value: string) {
          return builder
        },
        gt(_col: string, _value: string) {
          return builder
        },
        async maybeSingle() {
          return { data: state.anglesCacheRow, error: null }
        },
      }
      return builder
    },
    async upsert(row: Record<string, unknown>, _opts: unknown) {
      if (state.anglesUpsertError) return { error: state.anglesUpsertError }
      state.anglesUpserts.push(row)
      return { error: null }
    },
  }
}

const createServiceClientMock = jest.fn()
jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => createServiceClientMock(),
}))

function freshState(overrides: Partial<MockState> = {}): MockState {
  return {
    scan: SAMPLE_SCAN,
    healthCacheRow: null,
    anglesCacheRow: null,
    healthUpserts: [],
    anglesUpserts: [],
    ...overrides,
  }
}

describe('preWarmDemoNiche', () => {
  beforeEach(() => {
    generateVerdictMock.mockReset()
    generateAnglesMock.mockReset()
    createServiceClientMock.mockReset()
  })

  it('populates both caches when neither is warm', async () => {
    const state = freshState()
    createServiceClientMock.mockReturnValue(makeServiceClient(state))
    generateVerdictMock.mockResolvedValue('Premium AI verdict text')
    generateAnglesMock.mockResolvedValue([
      { title: 'A', hook: 'B', format: 'shorts', why: 'C' },
    ])

    const result = await preWarmDemoNiche('scan-1')

    expect(result.healthCheck).toBe(true)
    expect(result.angles).toBe(true)
    expect(state.healthUpserts).toHaveLength(1)
    expect(state.anglesUpserts).toHaveLength(1)
    expect(generateVerdictMock).toHaveBeenCalledTimes(1)
    expect(generateAnglesMock).toHaveBeenCalledTimes(1)
    expect(result.notes).toEqual(expect.arrayContaining(['health_warmed', 'angles_warmed']))
  })

  it('skips Anthropic calls when both caches are already warm (idempotent)', async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    const state = freshState({
      healthCacheRow: { expires_at: future },
      anglesCacheRow: { expires_at: future },
    })
    createServiceClientMock.mockReturnValue(makeServiceClient(state))

    const result = await preWarmDemoNiche('scan-1')

    expect(result.healthCheck).toBe(true)
    expect(result.angles).toBe(true)
    expect(state.healthUpserts).toHaveLength(0)
    expect(state.anglesUpserts).toHaveLength(0)
    expect(generateVerdictMock).not.toHaveBeenCalled()
    expect(generateAnglesMock).not.toHaveBeenCalled()
    expect(result.notes).toEqual(
      expect.arrayContaining(['health_already_warm', 'angles_already_warm']),
    )
  })

  it('warms only the half that is cold (mixed cache state)', async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    const state = freshState({ healthCacheRow: { expires_at: future } })
    createServiceClientMock.mockReturnValue(makeServiceClient(state))
    generateAnglesMock.mockResolvedValue([
      { title: 'A', hook: 'B', format: 'shorts', why: 'C' },
    ])

    const result = await preWarmDemoNiche('scan-1')

    expect(result.healthCheck).toBe(true)
    expect(result.angles).toBe(true)
    expect(generateVerdictMock).not.toHaveBeenCalled()
    expect(generateAnglesMock).toHaveBeenCalledTimes(1)
    expect(state.anglesUpserts).toHaveLength(1)
  })

  it('marks the scan-not-found case and never calls Anthropic', async () => {
    const state = freshState({ scan: null })
    createServiceClientMock.mockReturnValue(makeServiceClient(state))

    const result = await preWarmDemoNiche('missing')

    expect(result.healthCheck).toBe(false)
    expect(result.angles).toBe(false)
    expect(generateVerdictMock).not.toHaveBeenCalled()
    expect(generateAnglesMock).not.toHaveBeenCalled()
    expect(result.notes.some((n) => n.startsWith('scan_not_found'))).toBe(true)
  })

  it('does not throw when the verdict generator throws — angles still attempted', async () => {
    const state = freshState()
    createServiceClientMock.mockReturnValue(makeServiceClient(state))
    generateVerdictMock.mockRejectedValue(new Error('anthropic 429'))
    generateAnglesMock.mockResolvedValue([
      { title: 'A', hook: 'B', format: 'shorts', why: 'C' },
    ])

    const result = await preWarmDemoNiche('scan-1')

    expect(result.healthCheck).toBe(false)
    expect(result.angles).toBe(true)
    expect(state.anglesUpserts).toHaveLength(1)
    expect(result.notes.some((n) => n.startsWith('health_threw'))).toBe(true)
  })

  it('does not throw when both AI calls fail — returns flags false', async () => {
    const state = freshState()
    createServiceClientMock.mockReturnValue(makeServiceClient(state))
    generateVerdictMock.mockRejectedValue(new Error('boom1'))
    generateAnglesMock.mockRejectedValue(new Error('boom2'))

    const result = await preWarmDemoNiche('scan-1')

    expect(result.healthCheck).toBe(false)
    expect(result.angles).toBe(false)
  })

  it('reports upsert failures without throwing', async () => {
    const state = freshState({
      healthUpsertError: { message: 'rls_denied' },
      anglesUpsertError: { message: 'rls_denied' },
    })
    createServiceClientMock.mockReturnValue(makeServiceClient(state))
    generateVerdictMock.mockResolvedValue('verdict text')
    generateAnglesMock.mockResolvedValue([
      { title: 'A', hook: 'B', format: 'shorts', why: 'C' },
    ])

    const result = await preWarmDemoNiche('scan-1')

    expect(result.healthCheck).toBe(false)
    expect(result.angles).toBe(false)
    expect(result.notes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('health_upsert_failed'),
        expect.stringContaining('angles_upsert_failed'),
      ]),
    )
  })
})
