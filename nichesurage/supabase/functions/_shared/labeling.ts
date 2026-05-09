// supabase/functions/_shared/labeling.ts
//
// Niche labeling at watchlist insert. Used by discover and trending
// edge functions. Calls Anthropic Haiku with 15-20 video titles for
// the channel and asks for a 2-4 word niche label.
//
// Failure semantics: NEVER throws to caller. On any error (HTTP non-2xx,
// network, malformed response, empty titles list) returns the fallback
// string. Better to insert with a seed-keyword or empty fallback than to
// fail the whole insert flow.

const MAX_LABEL_CHARS = 40
const ANTHROPIC_TIMEOUT_MS = 5_000

export interface BuildNicheLabelArgs {
  apiKey: string
  channelName: string
  recentTitles: string[]
  /** Returned verbatim if labeling fails for any reason. */
  fallback: string
}

export async function buildNicheLabel(args: BuildNicheLabelArgs): Promise<string> {
  if (args.recentTitles.length === 0) return args.fallback

  const titlesText = args.recentTitles
    .slice(0, 20)
    .map(t => `- ${t}`)
    .join('\n')

  const prompt = `Given this YouTube channel name and its recent video titles, return a short niche label (2-4 words). Specific, not generic.

Examples of good labels:
- ai prompt engineering
- frugal couple finance
- body recomp for women
- minimalist survival cooking
- faceless stoic productivity

Examples of bad labels (too generic):
- tech, fitness, lifestyle, education

Channel: ${args.channelName}
Recent video titles:
${titlesText}

Respond with ONLY the niche label, lowercase, no quotes, no preamble.`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': args.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 30,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      console.warn(`buildNicheLabel: Anthropic ${res.status}, using fallback "${args.fallback}"`)
      return args.fallback
    }

    const data = await res.json()
    const text = data?.content?.[0]?.text
    if (typeof text !== 'string' || text.trim().length === 0) {
      return args.fallback
    }

    return text.trim().toLowerCase().slice(0, MAX_LABEL_CHARS)
  } catch (err) {
    console.warn(`buildNicheLabel: error, using fallback "${args.fallback}":`, err)
    return args.fallback
  } finally {
    clearTimeout(timeout)
  }
}
