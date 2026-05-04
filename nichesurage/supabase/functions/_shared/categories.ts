// supabase/functions/_shared/categories.ts
//
// Sprint B Phase 1: 12 industry-standard YouTube content categories.
// Used to bucket every channel in channels_watchlist for category-aware
// trend scoring (per-category baselines beat one global average).
//
// classifyChannelCategory() calls Claude Haiku with strict-JSON instructions.
// Defensive default: ANY error / unknown category falls back to 'education_howto'
// (the catch-all bucket). The classifier never throws — it always returns a
// valid CategoryEnum so callers can UPSERT without try/catch noise.

export const CATEGORIES = [
  'ai_tools', 'finance', 'crypto', 'tech_reviews',
  'gaming_streamers', 'fitness_health', 'self_improvement',
  'true_crime', 'luxury_lifestyle', 'celebrity_drama',
  'geopolitics_news', 'education_howto',
] as const

export type CategoryEnum = (typeof CATEGORIES)[number]

export const CATEGORY_DESCRIPTIONS: Record<CategoryEnum, string> = {
  ai_tools:           'AI tools, ChatGPT, Claude, productivity AI, generative content',
  finance:            'Investing, personal finance, stock market, retirement, budgeting',
  crypto:             'Cryptocurrency, blockchain, DeFi, NFTs, on-chain analysis',
  tech_reviews:       'Consumer electronics reviews, gadget unboxings, software reviews',
  gaming_streamers:   'Gaming content, Twitch/YT streamer culture, esports clips',
  fitness_health:     'Workouts, diet, nutrition, biohacking, mental health, wellness',
  self_improvement:   'Productivity, motivation, life advice, habits, success mindset',
  true_crime:         'Crime cases, investigations, court breakdowns, mystery stories',
  luxury_lifestyle:   'Cars, mansions, watches, travel, high-end consumption',
  celebrity_drama:    'Celebrity news, scandals, public feuds, gossip, reactions',
  geopolitics_news:   'International politics, breaking news, conflict analysis, policy',
  education_howto:    'Tutorials, explainers, science, history, general how-to (default catch-all)',
}

const DEFAULT_CATEGORY: CategoryEnum = 'education_howto'

// Injectable for tests. Defaults to global fetch (Deno provides natively).
export type FetchLike = typeof fetch

function isCategoryEnum(value: unknown): value is CategoryEnum {
  return typeof value === 'string'
    && (CATEGORIES as readonly string[]).includes(value)
}

/**
 * Classify a YouTube channel into ONE canonical category using Claude Haiku.
 * Cheap (~$0.0002/call), deterministic (temp=0). Returns 'education_howto'
 * as defensive default if Claude response is malformed or unknown, or if
 * any error (network, JSON, etc.) is thrown.
 *
 * @param channelTitle      Channel display name
 * @param channelDescription Channel "About" blurb
 * @param recentVideoTitles  Last ~5 video titles — strongest signal
 * @param apiKey             ANTHROPIC_API_KEY (caller's responsibility to provide)
 * @param fetchImpl          Optional fetch override for testing
 */
export async function classifyChannelCategory(
  channelTitle: string,
  channelDescription: string,
  recentVideoTitles: string[],
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<CategoryEnum> {
  if (!apiKey) {
    // Caller forgot the key. Don't pretend we classified anything;
    // a silent default would let bad rows accumulate. Throw is louder
    // and easier to spot in cron logs than a misclassification.
    throw new Error('classifyChannelCategory: apiKey is required')
  }

  try {
    const categoryList = CATEGORIES
      .map(c => `  - ${c}: ${CATEGORY_DESCRIPTIONS[c]}`)
      .join('\n')

    const titlesBlock = recentVideoTitles.length > 0
      ? recentVideoTitles.map(t => `- ${t}`).join('\n')
      : '(no recent videos)'

    const userPrompt = `Classify this YouTube channel into EXACTLY ONE of the categories below.

Channel name: ${channelTitle || '(unknown)'}
Channel description: ${channelDescription || '(empty)'}

Recent video titles:
${titlesBlock}

Available categories:
${categoryList}

Respond with ONLY a JSON object: {"category": "<snake_case_slug>"}.
No prose, no markdown, no backticks. The slug MUST be one of the listed categories.
If unsure, choose education_howto.`

    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 40,
        temperature: 0,
        system: 'You are a strict classifier. Respond with ONLY a JSON object of the form {"category": "<snake_case_slug>"}. Do not include any other text.',
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!res.ok) return DEFAULT_CATEGORY

    const data = await res.json() as { content?: Array<{ text?: string }> }
    const text = data.content?.[0]?.text?.trim() ?? ''
    if (!text) return DEFAULT_CATEGORY

    // Tolerate Claude wrapping JSON in stray prose/backticks despite instructions.
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return DEFAULT_CATEGORY

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return DEFAULT_CATEGORY
    }

    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_CATEGORY
    const candidate = (parsed as { category?: unknown }).category
    return isCategoryEnum(candidate) ? candidate : DEFAULT_CATEGORY
  } catch {
    // Network error, abort, or anything else — never escape.
    return DEFAULT_CATEGORY
  }
}
