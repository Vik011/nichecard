// supabase/functions/_shared/faceless.ts
//
// Apify Discovery Engine: faceless-channel classifier.
//
// NicheSurage's audience is faceless-channel creators. Discovery must
// hard-reject channels driven by an on-camera host/personality. This module
// asks Claude Haiku to decide, from a channel name plus a sample of its
// recent video titles, whether a channel is FACELESS, FACE, or UNCERTAIN.
//
// classifyFaceless() never throws: ANY error, timeout, or unparseable reply
// resolves to 'uncertain' so the caller can decide policy without try/catch
// noise. Structured exactly like categories.ts (injectable FetchLike, a hard
// timeout, defensive default).

// Injectable for tests. Defaults to global fetch (Deno provides natively).
export type FetchLike = typeof fetch

export type FacelessVerdict = 'faceless' | 'face' | 'uncertain'

const DEFAULT_VERDICT: FacelessVerdict = 'uncertain'
const ANTHROPIC_TIMEOUT_MS = 5_000

function isFacelessVerdict(value: unknown): value is FacelessVerdict {
  return value === 'faceless' || value === 'face' || value === 'uncertain'
}

/**
 * Classify a YouTube channel as FACELESS, FACE, or UNCERTAIN using Claude
 * Haiku. Cheap, deterministic (temp=0). Returns 'uncertain' as a defensive
 * default if the Claude response is malformed, non-2xx, times out, or any
 * error is thrown. NEVER throws.
 *
 * @param channelName       Channel display name
 * @param recentVideoTitles Sample of the channel's video titles - strongest signal
 * @param apiKey            ANTHROPIC_API_KEY (caller's responsibility to provide)
 * @param fetchImpl         Optional fetch override for testing
 */
export async function classifyFaceless(
  channelName: string,
  recentVideoTitles: string[],
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<FacelessVerdict> {
  if (!apiKey) return DEFAULT_VERDICT

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS)

  try {
    const titlesBlock = recentVideoTitles.length > 0
      ? recentVideoTitles.map(t => `- ${t}`).join('\n')
      : '(no recent videos)'

    const userPrompt = `Decide whether this YouTube channel is FACELESS or FACE.

FACELESS: a brand-style channel with no on-camera presenter. Examples:
compilations, AI voiceover, narration/documentary, screen recordings,
animation, listicles, text-on-screen.

FACE: a host or personality appears on camera. Examples: vlogs,
talking-head, reactions, personal brand.

Guidance: a personal-name channel name leans FACE; a brand-style channel
name leans FACELESS. But the video titles are the stronger signal - weigh
them above the channel name. If you genuinely cannot tell, answer uncertain.

Channel name: ${channelName || '(unknown)'}

Recent video titles:
${titlesBlock}

Respond with ONLY a JSON object: {"verdict": "faceless"|"face"|"uncertain"}.
No prose, no markdown, no backticks.`

    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 40,
        temperature: 0,
        system: 'You are a strict classifier. Respond with ONLY a JSON object of the form {"verdict": "faceless"|"face"|"uncertain"}. Do not include any other text.',
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!res.ok) return DEFAULT_VERDICT

    const data = await res.json() as { content?: Array<{ text?: string }> }
    const text = data.content?.[0]?.text?.trim() ?? ''
    if (!text) return DEFAULT_VERDICT

    // Tolerate Claude wrapping JSON in stray prose/backticks despite instructions.
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return DEFAULT_VERDICT

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return DEFAULT_VERDICT
    }

    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_VERDICT
    const candidate = (parsed as { verdict?: unknown }).verdict
    return isFacelessVerdict(candidate) ? candidate : DEFAULT_VERDICT
  } catch {
    // Network error, timeout/abort, or anything else - never escape.
    return DEFAULT_VERDICT
  } finally {
    clearTimeout(timeout)
  }
}
