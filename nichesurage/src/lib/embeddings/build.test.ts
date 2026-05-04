/**
 * @jest-environment node
 */

import {
  buildEmbedding,
  buildEmbeddingsBatch,
  EMBEDDING_DIM,
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_MAX_CHARS,
} from './build'

const ORIGINAL_ENV = process.env

function makeVec(seed: number): number[] {
  const v = new Array(EMBEDDING_DIM)
  for (let i = 0; i < EMBEDDING_DIM; i++) v[i] = ((seed + i) % 1000) / 1000
  return v
}

function mockOpenAIOk(call: { lastBody?: any }) {
  return jest.fn(async (_url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : null
    call.lastBody = body
    const inputs: string[] = body?.input ?? []
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          data: inputs.map((_, i) => ({ index: i, embedding: makeVec(i) })),
        }
      },
      async text() {
        return ''
      },
    } as unknown as Response
  })
}

describe('embeddings/build', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, OPENAI_API_KEY: 'test-key' }
  })
  afterEach(() => {
    process.env = ORIGINAL_ENV
    jest.restoreAllMocks()
  })

  it('embeds a single text and returns a 1536-dim array', async () => {
    const call: { lastBody?: any } = {}
    const fetchMock = mockOpenAIOk(call)
    global.fetch = fetchMock as any

    const vec = await buildEmbedding('hello world')
    expect(Array.isArray(vec)).toBe(true)
    expect(vec.length).toBe(EMBEDDING_DIM)
    expect(call.lastBody.input).toEqual(['hello world'])
    expect(call.lastBody.model).toBe('text-embedding-3-small')
  })

  it('throws on empty string', async () => {
    global.fetch = jest.fn() as any
    await expect(buildEmbedding('')).rejects.toThrow('cannot be empty')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('throws on whitespace-only string', async () => {
    global.fetch = jest.fn() as any
    await expect(buildEmbedding('   \n\t  ')).rejects.toThrow('cannot be empty')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('truncates input over EMBEDDING_MAX_CHARS before sending', async () => {
    const call: { lastBody?: any } = {}
    global.fetch = mockOpenAIOk(call) as any

    const long = 'x'.repeat(EMBEDDING_MAX_CHARS + 1000)
    await buildEmbedding(long)
    expect(call.lastBody.input[0].length).toBe(EMBEDDING_MAX_CHARS)
  })

  it('throws on API 500', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      async text() {
        return 'internal error'
      },
    })) as any
    await expect(buildEmbedding('hello')).rejects.toThrow('OpenAI embeddings failed: 500')
  })

  it('batch of 50 returns 50 vectors in one call', async () => {
    const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string)
      const inputs: string[] = body.input
      return {
        ok: true,
        status: 200,
        async json() {
          return { data: inputs.map((_, i) => ({ index: i, embedding: makeVec(i) })) }
        },
        async text() {
          return ''
        },
      } as unknown as Response
    })
    global.fetch = fetchMock as any

    const inputs = Array.from({ length: 50 }, (_, i) => `text ${i}`)
    const vecs = await buildEmbeddingsBatch(inputs)
    expect(vecs.length).toBe(50)
    expect(vecs[0].length).toBe(EMBEDDING_DIM)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('batch of 51 splits into two calls (50 + 1)', async () => {
    const calls: any[] = []
    const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string)
      const inputs: string[] = body.input
      calls.push(inputs.length)
      return {
        ok: true,
        status: 200,
        async json() {
          return { data: inputs.map((_, i) => ({ index: i, embedding: makeVec(i) })) }
        },
        async text() {
          return ''
        },
      } as unknown as Response
    })
    global.fetch = fetchMock as any

    const inputs = Array.from({ length: 51 }, (_, i) => `text ${i}`)
    const vecs = await buildEmbeddingsBatch(inputs)
    expect(vecs.length).toBe(51)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(calls).toEqual([EMBEDDING_BATCH_SIZE, 1])
  })

  it('batch with empty string throws and skips network call', async () => {
    global.fetch = jest.fn() as any
    await expect(buildEmbeddingsBatch(['hello', ''])).rejects.toThrow('cannot be empty')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns empty array for empty input', async () => {
    global.fetch = jest.fn() as any
    const out = await buildEmbeddingsBatch([])
    expect(out).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
