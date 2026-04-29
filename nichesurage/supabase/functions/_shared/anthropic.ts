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
