/** @jest-environment node */

// ─── next/headers cookies() mock ──────────────────────────────────────────
const cookieJar = new Map<string, { value: string; options: Record<string, unknown> }>()
jest.mock('next/headers', () => ({
  cookies: () => ({
    get: (k: string) => cookieJar.get(k),
    set: (k: string, v: string, opts: Record<string, unknown>) => cookieJar.set(k, { value: v, options: opts }),
  }),
}))

// ─── Supabase service-client mock ─────────────────────────────────────────
type Op = { table: string; method: string; payload?: unknown; where?: Record<string, unknown> }
const ops: Op[] = []
let selectResult: { data: Record<string, unknown> | null; error: { message: string } | null } = { data: null, error: null }
let insertResult: { error: { message: string } | null } = { error: null }

function buildClient() {
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      const chain = {
        insert: (payload: unknown) => {
          ops.push({ table, method: 'insert', payload })
          return Promise.resolve(insertResult)
        },
        select: (_cols: string) => chain,
        eq: (col: string, val: unknown) => {
          filters[col] = val
          return chain
        },
        single: () => {
          ops.push({ table, method: 'select-single', where: { ...filters } })
          return Promise.resolve(selectResult)
        },
      }
      return chain
    },
  }
}

jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => buildClient(),
}))

import { issueSudo, verifySudo, requireSudo, SUDO_COOKIE_NAME, SUDO_TTL_MS } from './sudo'

beforeEach(() => {
  cookieJar.clear()
  ops.length = 0
  selectResult = { data: null, error: null }
  insertResult = { error: null }
})

describe('issueSudo', () => {
  it('inserts admin_sessions row and sets HttpOnly/Secure/Strict cookie', async () => {
    await issueSudo('admin@x.com')
    expect(ops).toHaveLength(1)
    expect(ops[0].table).toBe('admin_sessions')
    expect(ops[0].method).toBe('insert')
    const payload = ops[0].payload as Record<string, unknown>
    expect(payload.admin_email).toBe('admin@x.com')
    expect(typeof payload.id).toBe('string')
    expect(typeof payload.sudo_until).toBe('string')

    const cookie = cookieJar.get(SUDO_COOKIE_NAME)
    expect(cookie).toBeDefined()
    expect(cookie!.value).toBe(payload.id)
    expect(cookie!.options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/admin',
      maxAge: SUDO_TTL_MS / 1000,
    })
  })

  it('throws if the DB insert fails', async () => {
    insertResult = { error: { message: 'db down' } }
    await expect(issueSudo('a@x.com')).rejects.toThrow(/db down/)
  })
})

describe('verifySudo', () => {
  it('returns invalid when no cookie present', async () => {
    const r = await verifySudo('a@x.com')
    expect(r).toEqual({ valid: false, sudoVerifiedAt: null })
  })

  it('returns invalid when session is for a different admin', async () => {
    cookieJar.set(SUDO_COOKIE_NAME, { value: 'session-id', options: {} })
    selectResult = {
      data: { admin_email: 'other@x.com', sudo_until: new Date(Date.now() + 60_000).toISOString() },
      error: null,
    }
    const r = await verifySudo('a@x.com')
    expect(r.valid).toBe(false)
  })

  it('returns invalid when sudo_until is in the past', async () => {
    cookieJar.set(SUDO_COOKIE_NAME, { value: 'session-id', options: {} })
    selectResult = {
      data: { admin_email: 'a@x.com', sudo_until: new Date(Date.now() - 1000).toISOString() },
      error: null,
    }
    const r = await verifySudo('a@x.com')
    expect(r.valid).toBe(false)
  })

  it('returns valid + sudoVerifiedAt when session is fresh', async () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    cookieJar.set(SUDO_COOKIE_NAME, { value: 'session-id', options: {} })
    selectResult = {
      data: { admin_email: 'a@x.com', sudo_until: future },
      error: null,
    }
    const r = await verifySudo('a@x.com')
    expect(r).toEqual({ valid: true, sudoVerifiedAt: future })
  })

  it('returns invalid when DB lookup errors', async () => {
    cookieJar.set(SUDO_COOKIE_NAME, { value: 'session-id', options: {} })
    selectResult = { data: null, error: { message: 'not found' } }
    const r = await verifySudo('a@x.com')
    expect(r.valid).toBe(false)
  })
})

describe('requireSudo', () => {
  it('returns the sudoVerifiedAt timestamp when valid', async () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    cookieJar.set(SUDO_COOKIE_NAME, { value: 's', options: {} })
    selectResult = { data: { admin_email: 'a@x.com', sudo_until: future }, error: null }
    expect(await requireSudo('a@x.com')).toBe(future)
  })

  it('throws when sudo is missing or expired', async () => {
    await expect(requireSudo('a@x.com')).rejects.toThrow(/sudo required/)
  })
})
