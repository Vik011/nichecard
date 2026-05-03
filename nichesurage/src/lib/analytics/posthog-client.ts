// Browser-side PostHog wrapper. Lazy-init pattern so dev builds without a
// posthog key remain a no-op. PII-safe: session recording off, autocapture
// off (we explicitly call capture() for the events we care about).
'use client'

import posthog from 'posthog-js'

let initialised = false

export function initPosthog(): void {
  if (initialised) return
  if (typeof window === 'undefined') return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    disable_session_recording: true,
    persistence: 'localStorage+cookie',
    person_profiles: 'identified_only',
  })
  initialised = true
}

export function captureClient(event: string, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  posthog.capture(event, properties)
}

export function identifyClient(distinctId: string, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  posthog.identify(distinctId, properties)
}

export function resetPosthog(): void {
  if (typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  posthog.reset()
}

export { posthog }
