import { anthropic } from '@/lib/anthropic/client'
import type { ContentAngle } from '@/lib/types'

export interface AnglesInput {
  niche_label: string
  channel_name: string
  language: string | null
  content_type: 'shorts' | 'longform'
  spike_multiplier: number | null
  subscriber_count: number | null
  opportunity_score: number | null
}

const SYSTEM_PROMPT = `You are a senior YouTube content strategist. A creator just identified an emerging niche and wants 5 concrete video ideas they can shoot this week.

Output ONLY a JSON array of 5 objects, no preamble, no markdown fences. Each object MUST have exactly these keys:
- "title": string, 50-70 characters, attention-grabbing, in the channel's primary language
- "hook": string, 1 sentence (under 20 words), the opening line spoken in the first 3 seconds
- "format": string, exactly "shorts" or "longform" (must match the channel's content type)
- "why": string, 1 sentence explaining why this idea fits this specific niche right now

Voice: direct, no hype, no filler, no exclamation marks. Specific, not generic. Reference the niche's actual topic.

Return ONLY valid JSON. No explanation. No markdown.`

export class AnglesParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AnglesParseError'
  }
}

export function parseAngles(raw: string, expectedFormat: 'shorts' | 'longform'): ContentAngle[] {
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    throw new AnglesParseError(`Invalid JSON: ${(err as Error).message}`)
  }
  if (!Array.isArray(parsed) || parsed.length !== 5) {
    throw new AnglesParseError(`Expected 5-element array, got ${Array.isArray(parsed) ? parsed.length : typeof parsed}`)
  }
  return parsed.map((item, i) => {
    const obj = item as Record<string, unknown>
    if (typeof obj.title !== 'string' || obj.title.length < 5) {
      throw new AnglesParseError(`Angle ${i}: missing or invalid title`)
    }
    if (typeof obj.hook !== 'string' || obj.hook.length < 5) {
      throw new AnglesParseError(`Angle ${i}: missing or invalid hook`)
    }
    if (obj.format !== 'shorts' && obj.format !== 'longform') {
      throw new AnglesParseError(`Angle ${i}: format must be 'shorts' or 'longform'`)
    }
    if (typeof obj.why !== 'string' || obj.why.length < 5) {
      throw new AnglesParseError(`Angle ${i}: missing or invalid why`)
    }
    return {
      title: obj.title,
      hook: obj.hook,
      format: (obj.format === expectedFormat ? obj.format : expectedFormat) as 'shorts' | 'longform',
      why: obj.why,
    }
  })
}

export async function generateAngles(input: AnglesInput): Promise<ContentAngle[]> {
  const userMessage = `Niche: ${input.niche_label}
Channel example: ${input.channel_name}
Language: ${input.language ?? 'unknown'} | Format: ${input.content_type}
Signals: spike ×${input.spike_multiplier ?? '?'}, ~${input.subscriber_count ?? '?'} subs, opportunity score ${input.opportunity_score ?? '?'}/100

Generate 5 ${input.content_type} video ideas tailored to this exact niche. Output JSON array only.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const block = message.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('Unexpected non-text response from Claude')
  }
  return parseAngles(block.text, input.content_type)
}
