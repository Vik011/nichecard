'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type ConsentValue = 'accepted' | 'declined'

const STORAGE_KEY = 'cookie_consent'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing) return

    const timer = setTimeout(() => setVisible(true), 500)
    return () => clearTimeout(timer)
  }, [])

  function handleConsent(value: ConsentValue) {
    localStorage.setItem(STORAGE_KEY, value)
    setVisible(false)

    if (typeof window !== 'undefined') {
      // posthog-js attaches itself to window; using the optional call pattern
      // avoids errors when PostHog hasn't loaded yet (e.g. ad blockers, dev).
      const ph = (window as Window & { posthog?: { opt_in_capturing: () => void; opt_out_capturing: () => void } }).posthog
      if (value === 'accepted') {
        ph?.opt_in_capturing()
      } else {
        ph?.opt_out_capturing()
      }
    }
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-carbon-900/95 backdrop-blur-sm border border-white/[0.08] rounded-t-xl sm:rounded-xl sm:mb-4 p-4 shadow-2xl">
        <p className="flex-1 text-sm text-slate-300">
          We use cookies to improve your experience. Analytics cookies are used only with your
          consent.{' '}
          <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300 underline transition-colors">
            Learn more in our Privacy Policy.
          </Link>
        </p>
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => handleConsent('accepted')}
            className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 min-h-[44px] rounded-lg transition-colors"
          >
            Accept
          </button>
          <button
            onClick={() => handleConsent('declined')}
            className="flex-1 sm:flex-none text-slate-400 hover:text-slate-200 text-sm px-4 py-2.5 min-h-[44px] transition-colors rounded-lg"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  )
}
