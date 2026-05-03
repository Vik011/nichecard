// Loaded by @sentry/nextjs in the Edge runtime (middleware + edge routes).
import * as Sentry from '@sentry/nextjs'
import { scrubSentryEvent } from './sentry.shared'

const DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,

    // Same scrubbing as server runtime — kills sensitive headers + URL
    // query params before the event leaves the edge.
    beforeSend: scrubSentryEvent,
  })
}
