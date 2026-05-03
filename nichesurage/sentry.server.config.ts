// Loaded by @sentry/nextjs on the Node.js server runtime.
import * as Sentry from '@sentry/nextjs'
import { scrubSentryEvent } from './sentry.shared'

const DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,

    // Strip auth headers, cookies, Stripe signature, and sensitive
    // URL query params from every event.
    beforeSend: scrubSentryEvent,
  })
}
