'use client'

import { useEffect, useState } from 'react'

// Hook that figures out whether the niche being shown is the legitimate
// first-login WOW demo. Used by both the welcome banner (decides whether
// to render at all) and NicheDetailContent (decides whether to render
// the AI sections as premium-unlocked).
//
// Three-way validation, same shape as before but consolidated into one
// place so we don't drift:
//   1. ?freeDemo=true is in the URL — quick reject for unrelated visits.
//   2. The `surgeniche_demo_seen` cookie is present — the auth callback
//      sets this; a hand-crafted URL won't have it.
//   3. The niche id matches today's pinned daily_demo_niche row, fetched
//      from the public read-only /api/demo/today endpoint.
//
// All three must pass to return 'legitimate'. The intermediate 'pending'
// state is important: components shouldn't render the locked teaser
// while the fetch is in flight, otherwise the demo modal flashes the
// wrong UI for a beat before the unlocked content takes over.

export type FreeDemoState = 'pending' | 'legitimate' | 'not-demo'

const DEMO_COOKIE_NAME = 'surgeniche_demo_seen'

export function useFreeDemoState(nicheId: string): FreeDemoState {
  const [state, setState] = useState<FreeDemoState>('pending')

  useEffect(() => {
    let cancelled = false
    async function validate() {
      // 1) URL flag — server-issued only via auth callback redirect.
      if (typeof window === 'undefined') return
      const params = new URLSearchParams(window.location.search)
      if (params.get('freeDemo') !== 'true') {
        if (!cancelled) setState('not-demo')
        return
      }

      // 2) Server-issued cookie. Free-demo flag without the cookie means
      //    someone copy-pasted the URL; treat as not-demo.
      if (!hasDemoCookie()) {
        if (!cancelled) setState('not-demo')
        return
      }

      // 3) Match against today's pinned niche.
      try {
        const res = await fetch('/api/demo/today', { cache: 'no-store' })
        if (cancelled) return
        if (!res.ok) {
          setState('not-demo')
          return
        }
        const data = (await res.json()) as { scanResultId: string | null }
        if (cancelled) return
        setState(data.scanResultId === nicheId ? 'legitimate' : 'not-demo')
      } catch {
        if (!cancelled) setState('not-demo')
      }
    }
    validate()
    return () => { cancelled = true }
  }, [nicheId])

  return state
}

function hasDemoCookie(): boolean {
  return document.cookie.split(';').some((c) => c.trim().startsWith(`${DEMO_COOKIE_NAME}=`))
}
