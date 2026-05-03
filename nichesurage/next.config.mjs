import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {}

const sentryConfig = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Don't fail the build when SENTRY_AUTH_TOKEN is missing (e.g. local builds).
  silent: !process.env.SENTRY_AUTH_TOKEN,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Tree-shake debug logger code from the bundle.
  webpack: { treeshake: { removeDebugLogging: true } },

  // Skip the upload step when no token (local dev builds).
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
}

export default withSentryConfig(nextConfig, sentryConfig)
