/** @jest-environment node */

const redirectMock = jest.fn<never, [string]>().mockImplementation(() => {
  throw new Error('NEXT_REDIRECT')
})
jest.mock('next/navigation', () => ({
  redirect: (...args: [string]) => redirectMock(...args),
}))

let existingRow: { admin_email: string } | null = null
function buildClient() {
  return {
    from(_table: string) {
      const filters: Record<string, unknown> = {}
      const chain = {
        select: () => chain,
        eq: (col: string, val: unknown) => { filters[col] = val; return chain },
        maybeSingle: () => Promise.resolve({ data: existingRow, error: null }),
      }
      return chain
    },
  }
}
jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => buildClient(),
}))

import { requireEnrollment } from './enrollmentGate'

beforeEach(() => {
  redirectMock.mockClear()
  existingRow = null
})

describe('requireEnrollment', () => {
  it('redirects to /admin/setup-totp when no admin_totp_secrets row exists', async () => {
    await expect(requireEnrollment('admin@x.com')).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/admin/setup-totp')
  })

  it('returns silently when the admin is already enrolled', async () => {
    existingRow = { admin_email: 'admin@x.com' }
    await expect(requireEnrollment('admin@x.com')).resolves.toBeUndefined()
    expect(redirectMock).not.toHaveBeenCalled()
  })
})
