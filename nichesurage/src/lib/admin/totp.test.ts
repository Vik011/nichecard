/** @jest-environment node */
import { generateSync, verifySync } from 'otplib'
import { encryptSecret, decryptSecret, generateSecret, generateOtpAuthUrl, verifyToken } from './totp'

const ORIGINAL_ENV = process.env
const TEST_KEY = '0'.repeat(64) // 32 bytes of zero in hex

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, ADMIN_TOTP_ENCRYPTION_KEY: TEST_KEY }
})

afterEach(() => {
  process.env = ORIGINAL_ENV
})

describe('totp', () => {
  it('encryptSecret + decryptSecret round-trip preserves the secret', () => {
    const secret = 'JBSWY3DPEHPK3PXP' // canonical otplib example
    const blob = encryptSecret(secret)
    expect(typeof blob).toBe('string') // base64 text
    expect(blob).not.toContain(secret) // not just a passthrough
    expect(decryptSecret(blob)).toBe(secret)
  })

  it('encrypted blobs are non-deterministic (random IV per call)', () => {
    const secret = 'JBSWY3DPEHPK3PXP'
    const a = encryptSecret(secret)
    const b = encryptSecret(secret)
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe(secret)
    expect(decryptSecret(b)).toBe(secret)
  })

  it('decryptSecret throws on tampered ciphertext (GCM auth tag mismatch)', () => {
    const blob = encryptSecret('JBSWY3DPEHPK3PXP')
    const buf = Buffer.from(blob, 'base64')
    buf[buf.length - 1] ^= 0xff // flip last byte
    const tampered = buf.toString('base64')
    expect(() => decryptSecret(tampered)).toThrow()
  })

  it('generateSecret returns a base32 string usable by otplib', () => {
    const secret = generateSecret()
    expect(secret).toMatch(/^[A-Z2-7]{16,}$/)
    // sanity: otplib accepts it and round-trips a token
    const token = generateSync({ secret, strategy: 'totp' })
    expect(verifyToken(token, secret)).toBe(true)
  })

  it('generateOtpAuthUrl encodes issuer + email + secret', () => {
    const url = generateOtpAuthUrl('admin@x.com', 'JBSWY3DPEHPK3PXP')
    expect(url).toMatch(/^otpauth:\/\/totp\//)
    expect(url).toContain('JBSWY3DPEHPK3PXP')
    expect(url).toContain(encodeURIComponent('admin@x.com'))
    expect(url).toMatch(/issuer=/)
  })

  it('verifyToken returns false for an invalid token', () => {
    const secret = generateSecret()
    expect(verifyToken('000000', secret)).toBe(false)
  })

  it('throws if ADMIN_TOTP_ENCRYPTION_KEY is missing', () => {
    delete process.env.ADMIN_TOTP_ENCRYPTION_KEY
    expect(() => encryptSecret('JBSWY3DPEHPK3PXP')).toThrow(/ADMIN_TOTP_ENCRYPTION_KEY/)
  })

  it('throws if ADMIN_TOTP_ENCRYPTION_KEY is wrong length', () => {
    process.env.ADMIN_TOTP_ENCRYPTION_KEY = 'abcd' // 2 bytes
    expect(() => encryptSecret('JBSWY3DPEHPK3PXP')).toThrow(/32 bytes/)
  })
})
