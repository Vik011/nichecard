/** @jest-environment node */

// ─── Mocks ────────────────────────────────────────────────────────────────
const requireAdminMock = jest.fn<Promise<{ id: string; email: string }>, []>()
jest.mock('@/lib/admin/auth', () => ({
  requireAdmin: () => requireAdminMock(),
}))

const verifyTokenMock = jest.fn<boolean, [string, string]>()
const encryptSecretMock = jest.fn<string, [string]>()
jest.mock('@/lib/admin/totp', () => ({
  verifyToken: (...args: [string, string]) => verifyTokenMock(...args),
  encryptSecret: (...args: [string]) => encryptSecretMock(...args),
}))

const generateCodesMock = jest.fn<string[], [number?]>()
const hashCodeMock = jest.fn<Promise<string>, [string]>()
jest.mock('@/lib/admin/backupCodes', () => ({
  generateCodes: (...args: [number?]) => generateCodesMock(...args),
  hashCode: (...args: [string]) => hashCodeMock(...args),
}))

type Op = { table: string; method: 'select-maybeSingle' | 'insert'; payload?: unknown; where?: Record<string, unknown> }
const ops: Op[] = []
let existingSecret: { admin_email: string } | null = null
let nextInsertError: { message: string } | null = null

function buildClient() {
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      const chain = {
        select: (_cols: string) => chain,
        eq: (col: string, val: unknown) => { filters[col] = val; return chain },
        maybeSingle: () => {
          ops.push({ table, method: 'select-maybeSingle', where: { ...filters } })
          if (table === 'admin_totp_secrets') {
            return Promise.resolve({ data: existingSecret, error: null })
          }
          return Promise.resolve({ data: null, error: null })
        },
        insert: (payload: unknown) => {
          ops.push({ table, method: 'insert', payload })
          return Promise.resolve({ error: nextInsertError })
        },
      }
      return chain
    },
  }
}

jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => buildClient(),
}))

import { enrollTotp } from './actions'

function fd(secret: string, token: string): FormData {
  const f = new FormData()
  f.set('secret', secret)
  f.set('token', token)
  return f
}

beforeEach(() => {
  ops.length = 0
  existingSecret = null
  nextInsertError = null
  requireAdminMock.mockReset().mockResolvedValue({ id: 'u-admin', email: 'admin@x.com' })
  verifyTokenMock.mockReset()
  encryptSecretMock.mockReset().mockReturnValue('ENCRYPTED-BLOB')
  generateCodesMock.mockReset().mockReturnValue([
    'AAAA-0001', 'AAAA-0002', 'AAAA-0003', 'AAAA-0004', 'AAAA-0005',
    'AAAA-0006', 'AAAA-0007', 'AAAA-0008', 'AAAA-0009', 'AAAA-0010',
  ])
  hashCodeMock.mockReset().mockImplementation(async (c) => `hash(${c})`)
})

describe('enrollTotp', () => {
  it('rejects when the admin is already enrolled (no double-enroll)', async () => {
    existingSecret = { admin_email: 'admin@x.com' }
    const result = await enrollTotp({ status: 'idle' }, fd('JBSWY3DPEHPK3PXP', '123456'))
    expect(result).toEqual({ status: 'error', error: 'already_enrolled' })
    expect(verifyTokenMock).not.toHaveBeenCalled()
    expect(ops).toHaveLength(1) // only the existence check
  })

  it('rejects an invalid 6-digit token', async () => {
    verifyTokenMock.mockReturnValue(false)
    const result = await enrollTotp({ status: 'idle' }, fd('JBSWY3DPEHPK3PXP', '000000'))
    expect(result).toEqual({ status: 'error', error: 'invalid_code' })
    expect(encryptSecretMock).not.toHaveBeenCalled()
  })

  it('rejects missing form fields', async () => {
    const empty = new FormData()
    const r1 = await enrollTotp({ status: 'idle' }, empty)
    expect(r1.status).toBe('error')
    const onlySecret = new FormData()
    onlySecret.set('secret', 'X')
    const r2 = await enrollTotp({ status: 'idle' }, onlySecret)
    expect(r2.status).toBe('error')
  })

  it('persists encrypted secret + 10 hashed backup codes on valid token, returns plaintext codes', async () => {
    verifyTokenMock.mockReturnValue(true)
    const result = await enrollTotp({ status: 'idle' }, fd('JBSWY3DPEHPK3PXP', '123456'))

    expect(result.status).toBe('success')
    if (result.status !== 'success') throw new Error('unreachable')
    expect(result.plaintextCodes).toHaveLength(10)
    expect(result.plaintextCodes[0]).toBe('AAAA-0001')

    // Verify INSERTs: 1 secret + 10 backup codes
    const inserts = ops.filter((o) => o.method === 'insert')
    expect(inserts).toHaveLength(11)
    const secretInsert = inserts.find((o) => o.table === 'admin_totp_secrets')
    expect(secretInsert?.payload).toMatchObject({
      admin_email: 'admin@x.com',
      encrypted_secret: 'ENCRYPTED-BLOB',
    })
    const backupInserts = inserts.filter((o) => o.table === 'admin_totp_backup_codes')
    expect(backupInserts).toHaveLength(10)
    expect(backupInserts[0].payload).toMatchObject({
      admin_email: 'admin@x.com',
      code_hash: 'hash(AAAA-0001)',
    })
  })

  it('returns persist_failed if the secret insert errors', async () => {
    verifyTokenMock.mockReturnValue(true)
    nextInsertError = { message: 'unique violation' }
    const result = await enrollTotp({ status: 'idle' }, fd('JBSWY3DPEHPK3PXP', '123456'))
    expect(result).toEqual({ status: 'error', error: 'persist_failed' })
  })

  it('returns not_admin if requireAdmin throws (defense)', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('NEXT_NOT_FOUND'))
    const result = await enrollTotp({ status: 'idle' }, fd('JBSWY3DPEHPK3PXP', '123456'))
    expect(result).toEqual({ status: 'error', error: 'not_admin' })
  })
})
