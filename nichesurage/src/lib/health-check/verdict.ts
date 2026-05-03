import { anthropic } from '@/lib/anthropic/client'
import type { ScoreResult } from './score'

export interface VerdictInput {
  niche_label: string
  channel_name: string
  language: string | null
  content_type: string | null
  score: ScoreResult
  spike_multiplier: number | null
  subscriber_count: number | null
  views_48h: number | null
  engagement_rate: number | null
}

const SYSTEM_PROMPT = `You are a senior YouTube growth strategist. Write one paragraph (3–5 sentences, max 90 words) verdicts for a niche's health.

Voice: direct, no hype, no filler, no exclamation marks. Be specific about risks AND opportunities. Do not restate the numeric score. Do not start with "This niche". Lead with the strongest signal (positive or negative). Address a creator deciding whether to enter this niche this week.`

export async function generateVerdict(input: VerdictInput): Promise<string> {
  const engagementPct = input.engagement_rate != null
    ? (input.engagement_rate * 100).toFixed(1) + '%'
    : '?'

  const userMessage = `Niche: ${input.niche_label}
Channel example: ${input.channel_name}
Language: ${input.language ?? 'unknown'} | Format: ${input.content_type ?? 'unknown'}
Score: ${input.score.score}/100 (spike ${input.score.components.spike.toFixed(1)}, opportunity ${input.score.components.opportunity.toFixed(1)}, engagement ${input.score.components.engagement.toFixed(1)}, virality ${input.score.components.virality}, saturation-room ${input.score.components.saturation})
Raw signals: spike ×${input.spike_multiplier ?? '?'}, ~${input.subscriber_count ?? '?'} subs, ${input.views_48h ?? '?'} views/48h, engagement ${engagementPct}.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 220,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const block = message.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('Unexpected non-text response from Claude')
  }
  return block.text.trim()
}
