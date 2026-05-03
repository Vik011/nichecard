// supabase/functions/_shared/openai.ts
// Thin wrapper around OpenAI embeddings. Used by cluster-outliers to embed
// outlier video titles + descriptions for centroid clustering.

const EMBED_URL = 'https://api.openai.com/v1/embeddings'
const MODEL = 'text-embedding-3-small'   // 1536 dims, ~$0.02 / 1M tokens
const BATCH = 100                        // OpenAI accepts up to 2048 inputs/req

export async function embedTexts(apiKey: string, texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH)
    const res = await fetch(EMBED_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, input: slice }),
    })
    if (!res.ok) throw new Error(`OpenAI embeddings failed ${res.status}: ${await res.text()}`)
    const data = await res.json()
    for (const item of data.data ?? []) out.push(item.embedding as number[])
  }
  return out
}
