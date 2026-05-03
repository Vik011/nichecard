// Initialised in the browser. Loaded automatically by @sentry/nextjs.
import * as Sentry from '@sentry/nextjs'

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,

    // Trace 10% of page loads + navigations.
    tracesSampleRate: 0.1,

    // Strip auth headers + cookies from breadcrumbs/events.
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['cookie']
      }
      return event
    },

    // Common noise to drop.
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],
  })
}
