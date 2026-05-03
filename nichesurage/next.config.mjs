import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // youtube-dl-exec ships a native yt-dlp binary that webpack would otherwise
    // fail to bundle into Vercel's serverless function output. Listing it here
    // tells Next.js to treat it as an external runtime package — the entire
    // node_modules/youtube-dl-exec dir (including the binary) is copied into
    // the function bundle as-is. Required for Sprint B trend engine's related-
    // video discovery (see /api/spike/ytdlp).
    serverComponentsExternalPackages: ['youtube-dl-exec'],
  },
}

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
