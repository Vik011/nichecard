import {
  checkAiQuota,
  getAiRunsToday,
  recordAiRun,
  todayUtc,
  tomorrowUtcMidnight,
  AI_DAILY_QUOTA,
} from './aiUsage'

// Minimal mock of just the shapes the helpers touch.
function makeSupabase({
  count = null as number | null,
  readError = null as { message: string } | null,
  rpcResult = null as number | null,
  rpcError = null as { message: string } | null,
} = {}) {
  const maybeSingle = jest.fn().mockResolvedValue({
    data: count !== null ? { count } : null,
    error: readError,
  })
  const eq2 = jest.fn().mockReturnValue({ maybeSingle })
  const eq1 = jest.fn().mockReturnValue({ eq: eq2 })
  const select = jest.fn().mockReturnValue({ eq: eq1 })
  const from = jest.fn().mockReturnValue({ select })

  const rpc = jest.fn().mockResolvedValue({
    data: rpcResult,
    error: rpcError,
  })

  // The cast is fine — our helpers only use these specific methods.
  return { from, rpc } as unknown as Parameters<typeof checkAiQuota>[0] & {
    from: jest.Mock
    rpc: jest.Mock
  }
}

const NOW = new Date('2026-05-03T10:00:00.000Z')

describe('todayUtc', () => {
  it('returns YYYY-MM-DD in UTC', () => {
    expect(todayUtc(new Date('2026-05-03T23:30:00.000Z'))).toBe('2026-05-03')
    expect(todayUtc(new Date('2026-05-04T00:30:00.000Z'))).toBe('2026-05-04')
  })
})

describe('tomorrowUtcMidnight', () => {
  it('returns the start of the next UTC day', () => {
    const r = tomorrowUtcMidnight(new Date('2026-05-03T13:30:00.000Z'))
    expect(r.toISOString()).toBe('2026-05-04T00:00:00.000Z')
  })

  it('handles month + year boundaries', () => {
    const r = tomorrowUtcMidnight(new Date('2026-12-31T23:59:59.999Z'))
    expect(r.toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })
})

describe('AI_DAILY_QUOTA', () => {
  it('matches the Sprint A.7 spec', () => {
    expect(AI_DAILY_QUOTA.free).toBe(0)
    expect(AI_DAILY_QUOTA.basic).toBe(1)
    expect(AI_DAILY_QUOTA.premium).toBe(Infinity)
  })
})

describe('checkAiQuota', () => {
  it('rejects FREE with reason=tier without hitting the DB', async () => {
    const supabase = makeSupabase()
    const r = await checkAiQuota(supabase, 'u', 'free', NOW)
    expect(r).toEqual({ ok: false, reason: 'tier', tier: 'free' })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('allows PREMIUM unconditionally without hitting the DB', async () => {
    const supabase = makeSupabase()
    const r = await checkAiQuota(supabase, 'u', 'premium', NOW)
    expect(r.ok).toBe(true)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('allows BASIC when under the daily limit', async () => {
    const supabase = makeSupabase({ count: 0 })
    const r = await checkAiQuota(supabase, 'u', 'basic', NOW)
    expect(r).toEqual({ ok: true, tier: 'basic', usedToday: 0, limit: 1 })
  })

  it('rejects BASIC at the daily limit with reason=limit + resetAt', async () => {
    const supabase = makeSupabase({ count: 1 })
    const r = await checkAiQuota(supabase, 'u', 'basic', NOW)
    expect(r.ok).toBe(false)
    if (r.ok === false && r.reason === 'limit') {
      expect(r.tier).toBe('basic')
      expect(r.usedToday).toBe(1)
      expect(r.limit).toBe(1)
      expect(r.resetAt.toISOString()).toBe('2026-05-04T00:00:00.000Z')
    } else {
      throw new Error('expected reason=limit')
    }
  })

  it('fails closed if reading usage errors out', async () => {
    const supabase = makeSupabase({ readError: { message: 'boom' } })
    const r = await checkAiQuota(supabase, 'u', 'basic', NOW)
    expect(r.ok).toBe(false)
  })
})

describe('getAiRunsToday', () => {
  it('returns 0 when no row exists', async () => {
    const supabase = makeSupabase({ count: null })
    expect(await getAiRunsToday(supabase, 'u', NOW)).toBe(0)
  })

  it('returns the stored count', async () => {
    const supabase = makeSupabase({ count: 3 })
    expect(await getAiRunsToday(supabase, 'u', NOW)).toBe(3)
  })

  it('returns +Infinity on a DB error (fail-closed)', async () => {
    const supabase = makeSupabase({ readError: { message: 'down' } })
    expect(await getAiRunsToday(supabase, 'u', NOW)).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('recordAiRun', () => {
  it('calls increment_ai_usage RPC with the user + day and returns the new count', async () => {
    const supabase = makeSupabase({ rpcResult: 1 })
    const newCount = await recordAiRun(supabase, 'user-42', NOW)
    expect(newCount).toBe(1)
    expect(supabase.rpc).toHaveBeenCalledWith('increment_ai_usage', {
      p_user_id: 'user-42',
      p_day: '2026-05-03',
    })
  })

  it('throws when the RPC errors', async () => {
    const supabase = makeSupabase({ rpcError: { message: 'pg down' } })
    await expect(recordAiRun(supabase, 'u', NOW)).rejects.toThrow(/pg down/)
  })

  it('returns 0 if the RPC returns null', async () => {
    const supabase = makeSupabase({ rpcResult: null })
    expect(await recordAiRun(supabase, 'u', NOW)).toBe(0)
  })
})
