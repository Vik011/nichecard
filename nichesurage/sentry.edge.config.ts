// Loaded by @sentry/nextjs in the Edge runtime (middleware + edge routes).
import * as Sentry from '@sentry/nextjs'

const DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  })
}
