// supabase/functions/_shared/anthropic.ts

export async function getNicheLabel(
  apiKey: string,
  channelName: string,
  topVideoTitles: string[]
): Promise<string> {
  const titlesText = topVideoTitles.map(t => `- ${t}`).join('\n')

  const prompt = `Given this YouTube channel name and its top video titles, return a short niche label (2-4 words, English).

Channel: ${channelName}
Top videos:
${titlesText}

Respond with only the niche label, nothing else.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 20,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) throw new Error(`Anthropic API failed ${res.status}: ${await res.text()}`)
  const data = await res.json()
  if (!data.content?.[0]?.text) {
    throw new Error(`Unexpected Anthropic response: ${JSON.stringify(data)}`)
  }
  return (data.content[0].text as string).trim()
}

// Sonar: generate a single premium niche label for a cluster of outlier videos.
// The strict prompt + 5 examples keeps Claude on-brand and away from generic words.
export async function getClusterLabel(
  apiKey: string,
  videos: { title: string; description: string }[]
): Promise<string> {
  const sample = videos.slice(0, 5)
    .map((v, i) => `${i + 1}. ${v.title}${v.description ? ` — ${v.description.slice(0, 140)}` : ''}`)
    .join('\n')

  const prompt = `You are naming a YouTube content niche based on outlier videos that just spiked. Generate ONE branded niche name (3-5 words). Specific, premium, creator-friendly. Avoid generic words like "Cooking", "Tech", "Tutorials", "Tips".

Examples of good labels:
- Minimalist Survival Cooking
- Faceless Stoic Productivity
- Underground AI Automation
- Quiet Luxury Fashion
- Slow Living Aesthetic

Output ONLY the label, no quotes, no preamble, no explanation.

Videos:
${sample}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 30,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic cluster label failed ${res.status}: ${await res.text()}`)
  const data = await res.json()
  if (!data.content?.[0]?.text) {
    throw new Error(`Unexpected Anthropic response: ${JSON.stringify(data)}`)
  }
  return (data.content[0].text as string).trim().replace(/^["']|["']$/g, '')
}
