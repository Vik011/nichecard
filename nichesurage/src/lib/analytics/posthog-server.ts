// Server-side PostHog client. Used inside API routes for events the browser
// can't witness (Stripe webhook, server-side checkout creation).
import { PostHog } from 'posthog-node'

let cached: PostHog | null = null

function getServer(): PostHog | null {
  if (cached) return cached
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'
  if (!key) return null
  cached = new PostHog(key, {
    host,
    flushAt: 1,
    flushInterval: 0,
  })
  return cached
}

interface CaptureArgs {
  distinctId: string
  event: string
  properties?: Record<string, unknown>
}

export async function captureServer({ distinctId, event, properties }: CaptureArgs): Promise<void> {
  const ph = getServer()
  if (!ph) return
  ph.capture({ distinctId, event, properties })
  await ph.shutdown()
}
