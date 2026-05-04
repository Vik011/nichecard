import { withSentryConfig } from '@sentry/nextjs'

// ─── Security headers ─────────────────────────────────────────────────
//
// Applied to every route via Next.js `headers()` config. CSP is intentionally
// written as a single config-side string (not nonce-injected via middleware)
// to keep the surface simple for a single-team app — once we have multiple
// front-ends or third-party widgets we can graduate to nonce-based CSP.
//
// Allowed origins:
//   - Supabase (auth + DB + edge functions): *.supabase.co
//   - Stripe (Checkout iframe + API): js.stripe.com, hooks.stripe.com, api.stripe.com
//   - PostHog (analytics): *.posthog.com, us.i.posthog.com, us-assets.i.posthog.com
//   - Sentry (error reporting): *.sentry.io, *.ingest.sentry.io
//   - Google (OAuth redirect): accounts.google.com
//   - Cloudflare Turnstile (login bot defense): challenges.cloudflare.com
//
// `unsafe-inline` + `unsafe-eval` for scripts is required by Next.js
// hydration runtime + framer-motion. Tightening this would require nonce
// middleware and is on the roadmap.

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.posthog.com https://us.i.posthog.com https://us-assets.i.posthog.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.posthog.com https://us.i.posthog.com https://*.sentry.io https://*.ingest.sentry.io https://accounts.google.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://accounts.google.com https://challenges.cloudflare.com",
  // No iframes from us — kills clickjacking.
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "upgrade-insecure-requests",
].join('; ')

const securityHeaders = [
  // Clickjacking defense (redundant with frame-ancestors but older browsers).
  { key: 'X-Frame-Options', value: 'DENY' },
  // MIME-sniff defense.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Limit referrer leakage to third parties.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable browser features we don't use (FLoC opt-out via interest-cohort).
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  // Force HTTPS for 2 years (with subdomain inclusion + preload eligibility).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // CSP enforced.
  { key: 'Content-Security-Policy', value: cspDirectives },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lint runs separately via `npm run lint` and CI; don't block production
  // builds on style violations. Type errors still fail the build (tsc runs).
  eslint: {
    ignoreDuringBuilds: true,
  },
  // image-hash + file-type ship `.wasm` assets that Next's webpack can't
  // bundle. Mark them external so the API route requires them from
  // node_modules at runtime (Node serverless runtime, not Edge).
  experimental: {
    serverComponentsExternalPackages: ['image-hash', 'file-type', 'sharp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
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
