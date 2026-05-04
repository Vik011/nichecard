/**
 * Thumbnail perceptual hashing.
 *
 * We use the `image-hash` package (DCT-based pHash) to produce a 64-bit hex
 * string, which we convert to BigInt for compact storage in
 * `video_thumbnail_phash.phash` (bigint column). Visually-similar images
 * produce hashes with low Hamming distance — the trend engine flags
 * thumbnails that hop across channels (likely viral copying signal).
 *
 * On any failure (network, decode error, timeout) we return null and log;
 * the caller decides whether to retry.
 */

import { imageHash } from 'image-hash'

const FETCH_TIMEOUT_MS = 5_000
const HASH_BITS = 64

/**
 * Compute a 64-bit perceptual hash for the image at `thumbnailUrl`.
 * Returns null on any error.
 */
export async function computePHash(thumbnailUrl: string): Promise<bigint | null> {
  try {
    // Fetch the image bytes ourselves so we can apply a hard timeout.
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    let buf: Buffer
    let ext: string | undefined
    try {
      const res = await fetch(thumbnailUrl, { signal: ctrl.signal })
      if (!res.ok) {
        console.error('[phash] fetch non-ok', thumbnailUrl, res.status)
        return null
      }
      const ab = await res.arrayBuffer()
      buf = Buffer.from(ab)
      const ct = res.headers.get('content-type') ?? ''
      // Map common YT thumbnail content-types to image-hash ext hint
      if (ct.includes('jpeg')) ext = 'jpg'
      else if (ct.includes('png')) ext = 'png'
      else if (ct.includes('webp')) ext = 'webp'
    } finally {
      clearTimeout(t)
    }

    const hex = await new Promise<string>((resolve, reject) => {
      imageHash(
        { ext, data: buf, name: 'thumb' },
        HASH_BITS,
        true,
        (err: Error | null, data?: string) => {
          if (err) reject(err)
          else if (typeof data === 'string') resolve(data)
          else reject(new Error('image-hash returned no data'))
        },
      )
    })

    // imageHash returns a hex string. 64 bits = 16 hex chars.
    return BigInt('0x' + hex)
  } catch (err) {
    console.error('[phash] computePHash failed', thumbnailUrl, err)
    return null
  }
}

/**
 * Hamming distance between two 64-bit BigInt hashes.
 * Pure function; XOR + popcount.
 */
export function hammingDistance(a: bigint, b: bigint): number {
  const ZERO = BigInt(0)
  const ONE = BigInt(1)
  let x = a ^ b
  let count = 0
  while (x !== ZERO) {
    // popcount one bit at a time — 64 iterations max, plenty fast
    x &= x - ONE
    count++
  }
  return count
}
