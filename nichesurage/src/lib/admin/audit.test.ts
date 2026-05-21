/** @jest-environment node */

// ─── Supabase service-client mock (chainable pattern from stripe webhook test) ───
type Inserted = { table: string; payload: Record<string, unknown> }
const inserts: Inserted[] = []
let nextInsertError: { message: string } | null = null

function buildClient() {
  return {
    from(table: string) {
      return {
        insert: (payload: Record<string, unknown>) => {
          inserts.push({ table, payload })
          return Promise.resolve({ error: nextInsertError })
        },
      }
    },
  }
}

jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => buildClient(),
}))

// ─── Sentry mock ──────────────────────────────────────────────────────────
const sentryCaptureMock = jest.fn()
jest.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => sentryCaptureMock(...args),
}))

import { logIntent, logOutcome } from './audit'

beforeEach(() => {
  inserts.length = 0
  nextInsertError = null
  sentryCaptureMock.mockReset()
})

describe('logIntent', () => {
  it('writes a phase=intent row and returns the intent_id', async () => {
    const id = await logIntent({
      adminEmail: 'admin@x.com',
      action: 'user.ban',
      targetType: 'user',
      targetId: 'usr_123',
      beforeJson: { tier: 'basic' },
      reason: 'spam evidence in audit logs',
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      sudoVerifiedAt: '2026-05-21T12:00:00Z',
    })
    expect(typeof id).toBe('string')
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(inserts).toHaveLength(1)
    expect(inserts[0].table).toBe('admin_audit_log')
    expect(inserts[0].payload).toMatchObject({
      admin_email: 'admin@x.com',
      action: 'user.ban',
      phase: 'intent',
      intent_id: id,
      target_type: 'user',
      target_id: 'usr_123',
      before_json: { tier: 'basic' },
      reason: 'spam evidence in audit logs',
      ip: '1.2.3.4',
      user_agent: 'Mozilla/5.0',
      sudo_verified_at: '2026-05-21T12:00:00Z',
    })
  })

  it('throws if the insert fails (action must abort)', async () => {
    nextInsertError = { message: 'connection lost' }
    await expect(logIntent({
      adminEmail: 'a@x.com', action: 'x', targetType: 't', targetId: null,
      beforeJson: null, reason: 'r'.repeat(25), ip: null, userAgent: null, sudoVerifiedAt: null,
    })).rejects.toThrow(/connection lost/)
  })
})

describe('logOutcome', () => {
  it('writes a phase=outcome row linked by intent_id', async () => {
    await logOutcome({
      intentId: '11111111-1111-1111-1111-111111111111',
      adminEmail: 'admin@x.com',
      action: 'user.ban',
      targetType: 'user',
      targetId: 'usr_123',
      outcome: 'success',
      afterJson: { tier: 'free', banned_at: '2026-05-21T12:00:00Z' },
      errorText: null,
    })
    expect(inserts).toHaveLength(1)
    expect(inserts[0].payload).toMatchObject({
      phase: 'outcome',
      intent_id: '11111111-1111-1111-1111-111111111111',
      outcome: 'success',
      after_json: { tier: 'free', banned_at: '2026-05-21T12:00:00Z' },
      error_text: null,
    })
  })

  it('does NOT throw when insert fails (action is already committed)', async () => {
    nextInsertError = { message: 'tx aborted' }
    await expect(logOutcome({
      intentId: '11111111-1111-1111-1111-111111111111',
      adminEmail: 'a@x.com', action: 'user.ban', targetType: 'user', targetId: 'u',
      outcome: 'success', afterJson: null, errorText: null,
    })).resolves.toBeUndefined()
  })

  it('captures orphaned-intent failures to Sentry', async () => {
    nextInsertError = { message: 'tx aborted' }
    await logOutcome({
      intentId: '22222222-2222-2222-2222-222222222222',
      adminEmail: 'a@x.com', action: 'user.ban', targetType: 'user', targetId: 'u',
      outcome: 'success', afterJson: null, errorText: null,
    })
    expect(sentryCaptureMock).toHaveBeenCalledTimes(1)
    const err = sentryCaptureMock.mock.calls[0][0] as Error
    expect(err.message).toMatch(/logOutcome/)
    const ctx = sentryCaptureMock.mock.calls[0][1] as { tags: Record<string, string> }
    expect(ctx.tags.intent_id).toBe('22222222-2222-2222-2222-222222222222')
    expect(ctx.tags.action).toBe('user.ban')
  })
})
