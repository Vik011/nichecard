/**
 * @jest-environment node
 *
 * Idempotency contract tests for the Stripe webhook handler. Stripe can deliver
 * the same event_id more than once (network retry, replay from dashboard). The
 * handler MUST:
 *   1. Process a new event exactly once and return 200.
 *   2. Drop a duplicate event (PK violation on stripe_webhook_events) and
 *      return 200 with `{ duplicate: true }`, without re-running the handler.
 *   3. On processing failure, DELETE the claim row so Stripe's retry isn't
 *      blocked, and return 500.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────

// stripe SDK — we control what constructEvent returns.
const constructEventMock = jest.fn()
jest.mock('@/lib/stripe/client', () => ({
  stripe: {
    webhooks: {
      constructEvent: (...args: unknown[]) => constructEventMock(...args),
    },
  },
}))

// price → tier mapping
jest.mock('@/lib/stripe/prices', () => ({
  tierFromPriceId: (id: string) => (id === 'price_basic_month' ? { tier: 'basic', interval: 'month' } : null),
}))

// PostHog — record calls but don't actually fire.
const captureServerMock = jest.fn().mockResolvedValue(undefined)
jest.mock('@/lib/analytics/posthog-server', () => ({
  captureServer: (...args: unknown[]) => captureServerMock(...args),
}))

// Supabase service client — records every operation; insert/update/delete/
// select outcomes are configurable per test via the `nextResults` map.
type Op = { table: string; method: 'insert' | 'update' | 'delete' | 'select'; payload?: unknown }
const ops: Op[] = []
type ResultRow =
  | { error: { code?: string; message: string } | null }
  | { data: unknown; error: { code?: string; message: string } | null }
const nextResults: { [k: string]: ResultRow } = {}

function buildMockClient() {
  return {
    from(table: string) {
      return {
        insert: (payload: unknown) => {
          ops.push({ table, method: 'insert', payload })
          return Promise.resolve(nextResults[`${table}.insert`] ?? { error: null })
        },
        update: (payload: unknown) => ({
          eq: () => {
            ops.push({ table, method: 'update', payload })
            return Promise.resolve(nextResults[`${table}.update`] ?? { error: null })
          },
        }),
        delete: () => ({
          eq: () => {
            ops.push({ table, method: 'delete' })
            return Promise.resolve(nextResults[`${table}.delete`] ?? { error: null })
          },
        }),
        select: (_cols: string) => ({
          eq: (_col: string, _val: unknown) => ({
            maybeSingle: () => {
              ops.push({ table, method: 'select' })
              return Promise.resolve(
                nextResults[`${table}.select`] ?? { data: null, error: null },
              )
            },
          }),
        }),
      }
    },
  }
}

jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => buildMockClient(),
}))

const sentryCaptureMessageMock = jest.fn()
jest.mock('@sentry/nextjs', () => ({
  captureMessage: (...args: unknown[]) => sentryCaptureMessageMock(...args),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────

import { POST } from './route'

beforeEach(() => {
  ops.length = 0
  for (const k of Object.keys(nextResults)) delete nextResults[k]
  constructEventMock.mockReset()
  captureServerMock.mockClear()
  sentryCaptureMessageMock.mockClear()
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
})

function makeReq(): Request {
  return new Request('https://surgeniche.com/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 't=1,v1=fake' },
    body: '{}',
  })
}

const subCreatedEvent = {
  id: 'evt_test_1',
  type: 'customer.subscription.created',
  data: {
    object: {
      id: 'sub_1',
      status: 'active',
      metadata: { supabase_user_id: 'user_1' },
      items: { data: [{ price: { id: 'price_basic_month' }, current_period_end: 1_700_000_000 }] },
    },
  },
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Stripe webhook idempotency', () => {
  it('first-time event: claim row, run handler, mark processed, return 200', async () => {
    constructEventMock.mockReturnValue(subCreatedEvent)

    const res = await POST(makeReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ received: true })

    // Insert claim row first, then update users, then mark processed_at.
    const eventOps = ops.filter(o => o.table === 'stripe_webhook_events')
    expect(eventOps[0]).toMatchObject({ method: 'insert', payload: expect.objectContaining({ event_id: 'evt_test_1' }) })
    expect(eventOps[1]).toMatchObject({ method: 'update', payload: expect.objectContaining({ processed_at: expect.any(String) }) })

    // Users row got upgraded.
    const userOps = ops.filter(o => o.table === 'users')
    expect(userOps).toHaveLength(1)
    expect(userOps[0].payload).toMatchObject({ tier: 'basic', billing_interval: 'month' })

    // PostHog fired once for subscription_started.
    expect(captureServerMock).toHaveBeenCalledTimes(1)
  })

  it('duplicate event: PK violation → 200 duplicate, handler skipped', async () => {
    constructEventMock.mockReturnValue(subCreatedEvent)
    nextResults['stripe_webhook_events.insert'] = {
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    }

    const res = await POST(makeReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ received: true, duplicate: true })

    // No users update, no PostHog, no processed_at update — handler never ran.
    expect(ops.filter(o => o.table === 'users')).toHaveLength(0)
    expect(captureServerMock).not.toHaveBeenCalled()
    const eventUpdates = ops.filter(o => o.table === 'stripe_webhook_events' && o.method === 'update')
    expect(eventUpdates).toHaveLength(0)
  })

  it('non-duplicate insert error: return 500 so Stripe retries', async () => {
    constructEventMock.mockReturnValue(subCreatedEvent)
    nextResults['stripe_webhook_events.insert'] = {
      error: { code: '08006', message: 'connection failure' },
    }

    const res = await POST(makeReq())

    expect(res.status).toBe(500)
    expect(ops.filter(o => o.table === 'users')).toHaveLength(0)
  })

  it('processing failure: DELETE claim row so retries can run, return 500', async () => {
    constructEventMock.mockReturnValue(subCreatedEvent)
    nextResults['users.update'] = {
      error: { code: 'XXX', message: 'simulated DB outage' },
    }

    const res = await POST(makeReq())

    expect(res.status).toBe(500)

    // Claim row was inserted, then deleted on failure — Stripe's next retry
    // will be allowed through the idempotency gate.
    const eventOps = ops.filter(o => o.table === 'stripe_webhook_events')
    expect(eventOps.map(o => o.method)).toEqual(['insert', 'delete'])
  })

  it('rejects bad signature with 400 before touching DB', async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const res = await POST(makeReq())

    expect(res.status).toBe(400)
    expect(ops).toHaveLength(0)
  })

  it('rejects missing signature header with 400', async () => {
    const req = new Request('https://surgeniche.com/api/stripe/webhook', {
      method: 'POST',
      body: '{}',
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(constructEventMock).not.toHaveBeenCalled()
    expect(ops).toHaveLength(0)
  })

  it('sets tier_source=stripe and tier_expires_at=null on subscription.updated', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_tier_source_updated',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_x',
          status: 'active',
          metadata: { supabase_user_id: 'usr_x' },
          items: { data: [{ price: { id: 'price_basic_month' }, current_period_end: 1735689600 }] },
        },
      },
    })
    const req = new Request('http://x', { method: 'POST', headers: { 'stripe-signature': 'sig' } })
    await POST(req as unknown as Parameters<typeof POST>[0])

    const usersUpdate = ops.find((o) => o.table === 'users' && o.method === 'update')
    expect(usersUpdate).toBeDefined()
    const payload = usersUpdate!.payload as Record<string, unknown>
    expect(payload.tier_source).toBe('stripe')
    expect(payload.tier_expires_at).toBeNull()
  })

  it('clears tier_source and tier_expires_at on subscription.deleted', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_tier_source_deleted',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_y',
          status: 'canceled',
          metadata: { supabase_user_id: 'usr_y' },
        },
      },
    })
    const req = new Request('http://x', { method: 'POST', headers: { 'stripe-signature': 'sig' } })
    await POST(req as unknown as Parameters<typeof POST>[0])

    const usersUpdate = ops.find((o) => o.table === 'users' && o.method === 'update')
    expect(usersUpdate).toBeDefined()
    const payload = usersUpdate!.payload as Record<string, unknown>
    expect(payload.tier_source).toBeNull()
    expect(payload.tier_expires_at).toBeNull()
  })

  it('subscription.deleted with missing metadata falls back to stripe_customer_id lookup', async () => {
    nextResults['users.select'] = { data: { id: 'usr_z' }, error: null }
    constructEventMock.mockReturnValue({
      id: 'evt_orphan_recovered',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_z',
          status: 'canceled',
          customer: 'cus_z',
          metadata: {},
        },
      },
    })
    const req = new Request('http://x', { method: 'POST', headers: { 'stripe-signature': 'sig' } })
    const res = await POST(req as unknown as Parameters<typeof POST>[0])
    expect(res.status).toBe(200)

    expect(ops.find((o) => o.table === 'users' && o.method === 'select')).toBeDefined()
    const usersUpdate = ops.find((o) => o.table === 'users' && o.method === 'update')
    expect(usersUpdate).toBeDefined()
    const payload = usersUpdate!.payload as Record<string, unknown>
    expect(payload.tier).toBe('free')
    expect(payload.subscription_status).toBe('canceled')
    expect(sentryCaptureMessageMock).not.toHaveBeenCalled()
  })

  it('subscription.deleted with no metadata and no matching customer fires Sentry alert and does not update', async () => {
    nextResults['users.select'] = { data: null, error: null }
    constructEventMock.mockReturnValue({
      id: 'evt_orphan_unrecovered',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_orphan',
          status: 'canceled',
          customer: 'cus_unknown',
          metadata: {},
        },
      },
    })
    const req = new Request('http://x', { method: 'POST', headers: { 'stripe-signature': 'sig' } })
    const res = await POST(req as unknown as Parameters<typeof POST>[0])
    expect(res.status).toBe(200)

    expect(sentryCaptureMessageMock).toHaveBeenCalledTimes(1)
    expect(sentryCaptureMessageMock.mock.calls[0][0]).toMatch(/orphan/)
    const usersUpdate = ops.find((o) => o.table === 'users' && o.method === 'update')
    expect(usersUpdate).toBeUndefined()
  })
})
