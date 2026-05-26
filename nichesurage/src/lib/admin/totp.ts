import crypto from 'crypto'
import { verifySync, generateSecret as otplibGenerateSecret, generateURI } from 'otplib'

const ISSUER = 'SurgeNiche Admin'

function getKey(): Buffer {
  const hex = process.env.ADMIN_TOTP_ENCRYPTION_KEY
  if (!hex) throw new Error('ADMIN_TOTP_ENCRYPTION_KEY env var is not set')
  const buf = Buffer.from(hex, 'hex')
  if (buf.length !== 32) {
    throw new Error(`ADMIN_TOTP_ENCRYPTION_KEY must be 32 bytes (64 hex chars), got ${buf.length}`)
  }
  return buf
}

/**
 * AES-256-GCM encrypt of a TOTP secret. Output layout (base64-encoded):
 *   [12-byte IV][16-byte authTag][N-byte ciphertext]
 * The IV is fresh per call (non-deterministic ciphertext).
 */
export function encryptSecret(secret: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct]).toString('base64')
}

export function decryptSecret(blob: string): string {
  const key = getKey()
  const buf = Buffer.from(blob, 'base64')
  if (buf.length < 12 + 16 + 1) throw new Error('encrypted blob too short')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ct = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

export function generateSecret(): string {
  return otplibGenerateSecret({ length: 20 })
}

export function generateOtpAuthUrl(email: string, secret: string): string {
  return generateURI({ strategy: 'totp', label: email, secret, issuer: ISSUER })
}

export function verifyToken(token: string, secret: string): boolean {
  const result = verifySync({ token, secret, strategy: 'totp' })
  return result.valid
}
