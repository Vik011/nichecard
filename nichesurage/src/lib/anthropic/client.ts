import Anthropic from '@anthropic-ai/sdk'

// Lazy-init: don't throw at module load (Next.js build collects route metadata
// without env vars present). Throw at first request instead.
let cached: Anthropic | undefined

function getClient(): Anthropic {
  if (!cached) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set')
    }
    cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return cached
}

export const anthropic = new Proxy({} as Anthropic, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver)
  },
})
