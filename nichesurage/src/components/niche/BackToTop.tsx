'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from '@phosphor-icons/react/dist/ssr'

interface BackToTopProps {
  /**
   * Accessible label, sourced from COPY at the call site so this component
   * stays locale-agnostic (no direct copy import).
   */
  label: string
  /**
   * Reveal the button once the user has scrolled past this many viewport
   * heights. Viewport-based (not card-count-based) so it behaves the same
   * across breakpoints and stays decoupled from the grid / "Show more".
   */
  thresholdVh?: number
}

// Sticky "Back to top" affordance for long, deep-scrolled lists (the expanded
// Discover All tab, 162 cards). The page scrolls via the window/document (no
// nested scroll container), so plain window.scrollY / window.scrollTo are the
// right primitives. Rendered at z-40 — above page content, below the z-50
// overlays (modals, cookie banner) so those always supersede it. All window
// access lives inside the effect / click handler, keeping it SSR-safe.
export function BackToTop({ label, thresholdVh = 1.5 }: BackToTopProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > thresholdVh * window.innerHeight)
    onScroll() // sync initial state (e.g. a restored scroll position on mount)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [thresholdVh])

  if (!visible) return null

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={[
        'fixed bottom-6 right-6 z-40',
        'inline-flex items-center justify-center h-11 w-11 rounded-full',
        'border border-hairline-edge bg-surface-raised/60 backdrop-blur-sm',
        'text-ink-muted hover:text-ink hover:bg-surface-elevated/70',
        'shadow-lg transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emerald/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
      ].join(' ')}
    >
      <ArrowUp size={20} weight="bold" aria-hidden />
    </button>
  )
}
