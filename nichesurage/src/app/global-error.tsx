'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body className="bg-carbon-950 text-slate-100 antialiased min-h-screen flex items-center justify-center px-4">
        <div className="glass glass-glow rounded-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-slate-100 text-lg font-semibold mb-2">Something went wrong</h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-5">
            We&apos;ve been notified and are looking into it. Try refreshing the page.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-[13px] font-semibold px-4 py-2 rounded-lg gborder bg-charcoal-800/60 text-slate-200 hover:bg-charcoal-700/60 transition-colors"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
