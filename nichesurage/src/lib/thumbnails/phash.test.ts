/**
 * @jest-environment node
 */

jest.mock('image-hash', () => ({
  imageHash: jest.fn(),
}))

import { computePHash, hammingDistance } from './phash'
import { imageHash } from 'image-hash'

const mockImageHash = imageHash as jest.MockedFunction<typeof imageHash>

const ZERO = BigInt(0)
const ONE = BigInt(1)
const ALL_ONES_64 = BigInt('0xffffffffffffffff')

function mockFetchOk(buf = Buffer.from([0xff, 0xd8, 0xff])): jest.Mock {
  return jest.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: (_: string) => 'image/jpeg' },
    async arrayBuffer() {
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    },
  })) as any
}

describe('hammingDistance', () => {
  it('returns 0 for identical hashes', () => {
    expect(hammingDistance(ZERO, ZERO)).toBe(0)
    expect(hammingDistance(BigInt(0xabcd), BigInt(0xabcd))).toBe(0)
  })

  it('returns 1 for hashes differing by one bit', () => {
    expect(hammingDistance(ZERO, ONE)).toBe(1)
    expect(hammingDistance(ZERO, BigInt(0x80))).toBe(1)
  })

  it('returns 64 for fully inverted 64-bit hashes', () => {
    expect(hammingDistance(ALL_ONES_64, ZERO)).toBe(64)
  })

  it('counts bits correctly for arbitrary values', () => {
    // 0b1010 vs 0b0101 → 4 differing bits
    expect(hammingDistance(BigInt(0b1010), BigInt(0b0101))).toBe(4)
  })
})

describe('computePHash', () => {
  beforeEach(() => {
    mockImageHash.mockReset()
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns BigInt for valid image', async () => {
    global.fetch = mockFetchOk() as any
    mockImageHash.mockImplementation((_src, _bits, _precise, cb: any) => {
      cb(null, '0123456789abcdef')
    })

    const result = await computePHash('https://example.com/thumb.jpg')
    expect(result).toBe(BigInt('0x0123456789abcdef'))
  })

  it('produces low hamming distance for visually-similar inputs (mocked)', async () => {
    global.fetch = mockFetchOk() as any

    mockImageHash.mockImplementationOnce((_s, _b, _p, cb: any) => cb(null, '0123456789abcdef'))
    const r1 = await computePHash('https://example.com/a.jpg')
    // Differs by 4 bits in the low nibble (f → 0)
    mockImageHash.mockImplementationOnce((_s, _b, _p, cb: any) => cb(null, '0123456789abcde0'))
    const r2 = await computePHash('https://example.com/b.jpg')
    expect(r1).not.toBeNull()
    expect(r2).not.toBeNull()
    expect(hammingDistance(r1!, r2!)).toBeLessThan(5)
  })

  it('produces high hamming distance for unrelated inputs (mocked)', async () => {
    global.fetch = mockFetchOk() as any
    mockImageHash.mockImplementationOnce((_s, _b, _p, cb: any) => cb(null, 'ffffffffffffffff'))
    const r1 = await computePHash('https://example.com/a.jpg')
    mockImageHash.mockImplementationOnce((_s, _b, _p, cb: any) => cb(null, '0000000000000000'))
    const r2 = await computePHash('https://example.com/b.jpg')
    expect(hammingDistance(r1!, r2!)).toBeGreaterThan(20)
  })

  it('returns null on fetch timeout (AbortError)', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = jest.fn(async () => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    }) as any
    const result = await computePHash('https://example.com/slow.jpg')
    expect(result).toBeNull()
  })

  it('returns null on non-ok HTTP response', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 404,
      headers: { get: () => null },
      async arrayBuffer() {
        return new ArrayBuffer(0)
      },
    })) as any
    const result = await computePHash('https://example.com/missing.jpg')
    expect(result).toBeNull()
  })

  it('returns null when image-hash callback errors (invalid image data)', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = mockFetchOk() as any
    mockImageHash.mockImplementation((_s, _b, _p, cb: any) => cb(new Error('bad image')))
    const result = await computePHash('https://example.com/garbage.jpg')
    expect(result).toBeNull()
  })

  it('returns null on fetch network error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = jest.fn(async () => {
      throw new Error('ENOTFOUND')
    }) as any
    const result = await computePHash('https://example.com/x.jpg')
    expect(result).toBeNull()
  })
})
