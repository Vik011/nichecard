// Initialised in the browser. Loaded automatically by @sentry/nextjs.
import * as Sentry from '@sentry/nextjs'
import { scrubSentryEvent } from './sentry.shared'

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,

    // Trace 10% of page loads + navigations.
    tracesSampleRate: 0.1,

    // Strip auth headers, cookies, and sensitive URL query params.
    beforeSend: scrubSentryEvent,
    beforeBreadcrumb: (breadcrumb) => {
      // Belt-and-braces: scrub URL inside breadcrumbs at capture time
      // (in case the event-level scrub misses a runtime path).
      if (breadcrumb?.data?.url && typeof breadcrumb.data.url === 'string') {
        // Defer to event-level scrubber by leaving the breadcrumb alone here.
        // (The event scrubber walks all breadcrumbs.)
      }
      return breadcrumb
    },

    // Common noise to drop.
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],
  })
}
