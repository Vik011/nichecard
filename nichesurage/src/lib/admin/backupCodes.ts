import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const BCRYPT_ROUNDS = 10
export const formatRegex = /^[A-F0-9]{4}-[A-F0-9]{4}$/

/**
 * Generate `count` plaintext backup codes (default 10). The caller is
 * responsible for hashing each via hashCode() before persisting and for
 * showing the plaintext to the admin EXACTLY ONCE at enroll time.
 *
 * Format: XXXX-XXXX (8 hex chars uppercase). 4 bytes of crypto.randomBytes
 * give 32 bits of entropy per code, 320 bits total over 10 codes. With
 * single-use enforcement, that's ample against online guessing.
 */
export function generateCodes(count: number = 10): string[] {
  const out: string[] = []
  while (out.length < count) {
    const hex = crypto.randomBytes(4).toString('hex').toUpperCase()
    const formatted = `${hex.slice(0, 4)}-${hex.slice(4, 8)}`
    if (!out.includes(formatted)) out.push(formatted)
  }
  return out
}

export async function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, BCRYPT_ROUNDS)
}

export async function verifyCode(code: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(code, hash)
  } catch {
    return false
  }
}
