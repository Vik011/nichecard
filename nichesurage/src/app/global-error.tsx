'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body className="bg-canvas text-ink antialiased min-h-screen flex items-center justify-center px-4">
        <div className="glass glass-glow rounded-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-ink text-lg font-semibold mb-2">Something went wrong</h1>
          <p className="text-ink-subtle text-sm leading-relaxed mb-5">
            We&apos;ve been notified and are looking into it. Try refreshing the page.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-[13px] font-semibold px-4 py-2 rounded-lg gborder bg-surface-elevated/60 text-ink hover:bg-surface-overlay/60 transition-colors"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
