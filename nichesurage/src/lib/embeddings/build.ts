/**
 * OpenAI text-embedding-3-small wrapper.
 *
 * Direct HTTP — we don't take an `openai` npm dep. The endpoint is stable
 * and we only need one POST. text-embedding-3-small returns 1536-dim vectors.
 * Inputs are truncated to 8000 chars (well under the model's 8192-token limit
 * for safety; rough rule: 1 token ~ 4 chars). Empty / whitespace-only inputs
 * throw — those are caller bugs we want loud.
 */

const ENDPOINT = 'https://api.openai.com/v1/embeddings'
const MODEL = 'text-embedding-3-small'
const DIM = 1536
export const EMBEDDING_DIM = DIM
export const EMBEDDING_MAX_CHARS = 8000
export const EMBEDDING_BATCH_SIZE = 50

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>
}

function truncate(text: string): string {
  return text.length > EMBEDDING_MAX_CHARS ? text.slice(0, EMBEDDING_MAX_CHARS) : text
}

function assertNonEmpty(text: string): void {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('embedding input cannot be empty')
  }
}

async function postEmbeddings(inputs: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: MODEL, input: inputs }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenAI embeddings failed: ${res.status} ${body.slice(0, 200)}`)
  }
  const json = (await res.json()) as OpenAIEmbeddingResponse
  if (!Array.isArray(json.data) || json.data.length !== inputs.length) {
    throw new Error('OpenAI embeddings response malformed')
  }
  // Sort by index to be defensive — OpenAI returns in order but spec says
  // it's index-keyed.
  const sorted = [...json.data].sort((a, b) => a.index - b.index)
  return sorted.map((d) => d.embedding)
}

/**
 * Embed a single string. Returns a 1536-dim vector.
 * Throws if input is empty/whitespace, OPENAI_API_KEY missing, or API errors.
 */
export async function buildEmbedding(text: string): Promise<number[]> {
  assertNonEmpty(text)
  const [vec] = await postEmbeddings([truncate(text)])
  return vec
}

/**
 * Embed an array of strings, batched at EMBEDDING_BATCH_SIZE per OpenAI call.
 * Returns vectors in the same order as the input. Each input is individually
 * checked for non-empty and truncated.
 */
export async function buildEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (!Array.isArray(texts) || texts.length === 0) return []
  for (const t of texts) assertNonEmpty(t)
  const truncated = texts.map(truncate)

  const out: number[][] = []
  for (let i = 0; i < truncated.length; i += EMBEDDING_BATCH_SIZE) {
    const slice = truncated.slice(i, i + EMBEDDING_BATCH_SIZE)
    const vecs = await postEmbeddings(slice)
    out.push(...vecs)
  }
  return out
}
