/**
 * Sprint B Phase 5C — narrative archetype matching via Claude Haiku.
 *
 * Given a cluster of video titles, we ask Claude Haiku to either:
 *   (a) match it to one of the 15 canonical archetypes, OR
 *   (b) propose a new candidate archetype (snake_case slug + display label).
 *
 * The model output is parsed defensively. Any malformed response (bad JSON,
 * shape mismatch, slug that doesn't match the regex, etc.) falls back to the
 * neutral default `education_howto` so a single bad LLM call cannot abort
 * the whole cluster-persist run.
 */

const CANONICAL_ARCHETYPES = [
  'ai_money',
  'outrage_drama',
  'transformation',
  'scam_exposure',
  'luxury_flex',
  'tutorial_exploit',
  'controversy',
  'celebrity_collapse',
  'impossible_achievement',
  'emotional_confession',
  'productivity_obsession',
  'hidden_wealth',
  'crime_mystery',
  'streamer_humiliation',
  'shocking_comparison',
] as const

const SLUG_RE = /^[a-z][a-z0-9_]{2,40}$/
const DEFAULT_FALLBACK = {
  archetype_id: 'education_howto',
  display_label: 'Education / How-To',
  is_new: false,
} as const

export interface ArchetypeMatch {
  archetype_id: string
  display_label: string
  is_new: boolean
}

export const CANONICAL_ARCHETYPE_IDS: readonly string[] = CANONICAL_ARCHETYPES

export function buildArchetypePrompt(titles: string[]): string {
  const titleBlock = titles.map((t) => `- ${t}`).join('\n')
  return `Here is a cluster of videos that appear to share a narrative theme:

${titleBlock}

Match this cluster to ONE of these canonical archetypes:
- ai_money: Get-rich-with-AI hype
- outrage_drama: Public outrage / call-out content
- transformation: Before-after / glow-up
- scam_exposure: Exposing scams or grifters
- luxury_flex: Conspicuous wealth display
- tutorial_exploit: How-to that exploits a niche advantage
- controversy: Divisive opinion bait
- celebrity_collapse: Celebrity downfall coverage
- impossible_achievement: Extreme accomplishment
- emotional_confession: Vulnerable personal story
- productivity_obsession: Optimization / hustle content
- hidden_wealth: Secret-money / underground business
- crime_mystery: True crime / unsolved
- streamer_humiliation: Streamer fail compilation
- shocking_comparison: Surprising side-by-side

If NONE of these fit, propose a new archetype with a snake_case slug (3 words max) and a 2-4 word display label.

Return ONLY this JSON shape:
{ "archetype_id": "snake_case_slug", "display_label": "Title Case Label", "is_new": false }

Set is_new=true ONLY if you proposed a new archetype not in the canonical list.`
}

const SYSTEM_PROMPT =
  'You classify YouTube video clusters into narrative archetypes. Return strict JSON.'

/**
 * Parse Claude's text response into a validated ArchetypeMatch, defending
 * against:
 *   - markdown code fences (```json ... ```)
 *   - leading/trailing whitespace
 *   - non-JSON garbage
 *   - missing fields, wrong types
 *   - slug that doesn't match regex
 *   - display_label outside 1–60 chars
 *
 * Returns DEFAULT_FALLBACK on any failure.
 */
export function parseArchetypeResponse(raw: string): ArchetypeMatch {
  if (typeof raw !== 'string') return { ...DEFAULT_FALLBACK }
  let text = raw.trim()
  // Strip ```json … ``` or ``` … ``` fences if present.
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fenceMatch) text = fenceMatch[1].trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ...DEFAULT_FALLBACK }
  }
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_FALLBACK }
  const obj = parsed as Record<string, unknown>
  const archetype_id = obj.archetype_id
  const display_label = obj.display_label
  const is_new = obj.is_new

  if (typeof archetype_id !== 'string' || !SLUG_RE.test(archetype_id)) {
    return { ...DEFAULT_FALLBACK }
  }
  if (
    typeof display_label !== 'string' ||
    display_label.length < 1 ||
    display_label.length > 60
  ) {
    return { ...DEFAULT_FALLBACK }
  }
  if (typeof is_new !== 'boolean') return { ...DEFAULT_FALLBACK }

  return { archetype_id, display_label, is_new }
}

/**
 * Direct fetch call to Anthropic — deliberately NOT using @anthropic-ai/sdk
 * to keep zero deps. Mirrors the pattern in supabase/functions/_shared/anthropic.ts.
 *
 * Throws on any network/HTTP failure. Caller should catch and fall through to
 * the default fallback.
 */
export async function callClaudeForArchetype(
  apiKey: string,
  titles: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 100,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildArchetypePrompt(titles) }],
    }),
  })
  if (!res.ok) {
    throw new Error(`Anthropic archetype call failed ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  const text = data?.content?.[0]?.text
  if (typeof text !== 'string') {
    throw new Error(`Unexpected Anthropic response: ${JSON.stringify(data).slice(0, 500)}`)
  }
  return text
}

export const DEFENSIVE_DEFAULT: ArchetypeMatch = { ...DEFAULT_FALLBACK }
