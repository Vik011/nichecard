'use client'

import { useEffect, useState } from 'react'

export type ViewportMode = 'mobile' | 'tablet' | 'desktop'

// Tailwind breakpoint boundaries. Keep aligned with tailwind.config defaults.
const MOBILE_MAX = 640  // < 640 = mobile
const TABLET_MAX = 1024 // < 1024 = tablet, >= 1024 = desktop

function modeFor(width: number): ViewportMode {
  if (width < MOBILE_MAX) return 'mobile'
  if (width < TABLET_MAX) return 'tablet'
  return 'desktop'
}

export function useViewportMode(): ViewportMode {
  // SSR-safe default: assume desktop. /discover is desktop-dominant
  // and the bottom sheet vs centered dialog branch is a client-only
  // concern (modal mounts after hydration via URL param anyway).
  const [mode, setMode] = useState<ViewportMode>('desktop')

  useEffect(() => {
    function update() {
      setMode(modeFor(window.innerWidth))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return mode
}
