'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

// Route-segment error boundary for /discover. Unlike global-error.tsx (which
// replaces the entire document, losing the nav shell), this keeps the
// DiscoverLayout's TopNav mounted and only swaps the page body — so a failed
// feed render degrades to an in-page retry card instead of a full app blank-out.
// `reset()` re-renders the segment, which re-runs the data fetch.
export default function DiscoverError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="min-h-screen bg-canvas text-ink px-4 py-16 max-w-6xl mx-auto flex items-center justify-center">
      <div className="glass glass-glow rounded-2xl p-8 max-w-md w-full text-center">
        <h1 className="text-ink text-lg font-semibold mb-2">
          Couldn&apos;t load Discover
        </h1>
        <p className="text-ink-subtle text-sm leading-relaxed mb-5">
          Something went wrong loading the feed. We&apos;ve been notified — try
          again in a moment.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="text-[13px] font-semibold px-4 py-2 rounded-lg gborder bg-surface-elevated/60 text-ink hover:bg-surface-overlay/60 transition-colors"
        >
          Try again
        </button>
      </div>
    </main>
  )
}
