/**
 * @jest-environment node
 *
 * Pure-logic tests for the admin allowlist. The requireAdmin server-side
 * call is integration-level (touches Supabase auth + Next notFound) and
 * is exercised end-to-end on deploy; we just verify the email check here.
 */

import { isAdminEmail } from './auth'

const ORIGINAL_ENV = process.env

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('isAdminEmail', () => {
  it('returns false when ADMIN_EMAILS is unset', () => {
    delete process.env.ADMIN_EMAILS
    expect(isAdminEmail('foo@example.com')).toBe(false)
  })

  it('returns false for null/undefined input', () => {
    process.env.ADMIN_EMAILS = 'foo@example.com'
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
    expect(isAdminEmail('')).toBe(false)
  })

  it('matches a single allowed email exactly', () => {
    process.env.ADMIN_EMAILS = 'admin@surgeniche.com'
    expect(isAdminEmail('admin@surgeniche.com')).toBe(true)
    expect(isAdminEmail('user@surgeniche.com')).toBe(false)
  })

  it('matches one of several comma-separated allowed emails', () => {
    process.env.ADMIN_EMAILS = 'a@x.com, b@x.com,  c@x.com'
    expect(isAdminEmail('a@x.com')).toBe(true)
    expect(isAdminEmail('b@x.com')).toBe(true)
    expect(isAdminEmail('c@x.com')).toBe(true)
    expect(isAdminEmail('d@x.com')).toBe(false)
  })

  it('is case-insensitive on both sides', () => {
    process.env.ADMIN_EMAILS = 'Admin@Example.com'
    expect(isAdminEmail('admin@example.com')).toBe(true)
    expect(isAdminEmail('ADMIN@example.COM')).toBe(true)
  })

  it('ignores whitespace around entries', () => {
    process.env.ADMIN_EMAILS = '   spaced@x.com  '
    expect(isAdminEmail('spaced@x.com')).toBe(true)
  })

  it('ignores empty entries (trailing/leading commas)', () => {
    process.env.ADMIN_EMAILS = ',,a@x.com,,b@x.com,'
    expect(isAdminEmail('a@x.com')).toBe(true)
    expect(isAdminEmail('b@x.com')).toBe(true)
    // The empty-string entries must NOT make `isAdminEmail('')` true.
    expect(isAdminEmail('')).toBe(false)
  })
})

// ─── assertAdminIsActive — DB-side admin flag check ──────────────────────

const supabaseQueryMock = jest.fn()
jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => supabaseQueryMock(),
        }),
      }),
    }),
  }),
}))

import { assertAdminIsActive } from './auth'

beforeEach(() => {
  supabaseQueryMock.mockReset()
})

describe('assertAdminIsActive', () => {
  it('returns true when users.is_admin = true', async () => {
    supabaseQueryMock.mockResolvedValue({ data: { is_admin: true }, error: null })
    expect(await assertAdminIsActive('user-id-1')).toBe(true)
  })

  it('returns false when users.is_admin = false', async () => {
    supabaseQueryMock.mockResolvedValue({ data: { is_admin: false }, error: null })
    expect(await assertAdminIsActive('user-id-2')).toBe(false)
  })

  it('returns false when no row exists', async () => {
    supabaseQueryMock.mockResolvedValue({ data: null, error: null })
    expect(await assertAdminIsActive('user-id-3')).toBe(false)
  })

  it('returns false on DB error (fail closed)', async () => {
    supabaseQueryMock.mockResolvedValue({ data: null, error: { message: 'connection lost' } })
    expect(await assertAdminIsActive('user-id-4')).toBe(false)
  })
})
