/** @jest-environment node */
import { generateCodes, hashCode, verifyCode, formatRegex } from './backupCodes'

describe('backupCodes', () => {
  it('generateCodes returns 10 unique codes by default', () => {
    const codes = generateCodes()
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
  })

  it('generateCodes respects requested count', () => {
    expect(generateCodes(3)).toHaveLength(3)
  })

  it('every generated code matches the documented format XXXX-XXXX', () => {
    const codes = generateCodes()
    for (const c of codes) expect(c).toMatch(formatRegex)
  })

  it('hashCode + verifyCode round-trip succeeds', async () => {
    const code = generateCodes(1)[0]
    const hash = await hashCode(code)
    expect(hash).not.toContain(code)
    expect(hash.startsWith('$2')).toBe(true) // bcrypt prefix
    expect(await verifyCode(code, hash)).toBe(true)
  })

  it('verifyCode rejects a wrong code', async () => {
    const hash = await hashCode('AAAA-BBBB')
    expect(await verifyCode('CCCC-DDDD', hash)).toBe(false)
  })

  it('verifyCode rejects garbage hash without throwing', async () => {
    expect(await verifyCode('AAAA-BBBB', 'not-a-hash')).toBe(false)
  })
})
