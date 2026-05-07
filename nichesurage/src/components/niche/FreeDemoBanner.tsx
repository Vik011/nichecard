'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkle, ArrowRight } from '@phosphor-icons/react/dist/ssr'
import type { CopyKeys } from '@/components/landing/copy'

interface FreeDemoBannerProps {
  /** scan_result.id of the niche being rendered. Compared against the */
  /** server-pinned daily demo to suppress hand-crafted ?freeDemo=true URLs. */
  nicheId: string
  copy: CopyKeys
}

const DEMO_COOKIE_NAME = 'surgeniche_demo_seen'

/**
 * Welcome banner shown on the user's first-login demo niche detail page.
 *
 * Three-way validation:
 *   1. ?freeDemo=true is in the URL (signal from the auth callback redirect).
 *   2. The `surgeniche_demo_seen` cookie is set (server-issued; can't be
 *      forged easily via copy-pasted URL).
 *   3. The niche id matches the server-pinned daily demo (final guard
 *      against stale shared links).
 *
 * If any of those fails, render nothing — the user lands on a regular
 * niche detail page without the welcome flourish.
 */
export function FreeDemoBanner({ nicheId, copy }: FreeDemoBannerProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function validate() {
      // 1. URL flag
      const params = new URLSearchParams(window.location.search)
      if (params.get('freeDemo') !== 'true') return

      // 2. Server-issued cookie
      if (!hasDemoCookie()) return

      // 3. Match against today's pinned niche
      try {
        const res = await fetch('/api/demo/today', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { scanResultId: string | null }
        if (cancelled) return
        if (data.scanResultId === nicheId) setShow(true)
      } catch {
        // network error → silently skip the banner
      }
    }
    validate()
    return () => { cancelled = true }
  }, [nicheId])

  if (!show) return null

  return (
    <section
      role="status"
      aria-live="polite"
      className="glass glass-glow rounded-2xl p-5 mb-6 flex items-start gap-4 border border-emerald-400/20"
    >
      <div className="shrink-0 mt-0.5">
        <Sparkle weight="duotone" size={22} className="text-emerald-300" aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-100 text-sm font-medium leading-snug">
          {copy.freeDemoBannerHeadline}
        </p>
        <p className="text-slate-400 text-[13px] leading-snug mt-1">
          {copy.freeDemoBannerSub}
        </p>
      </div>
      <Link
        href="/discover"
        className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-indigo-300 hover:text-indigo-200 transition-colors"
      >
        {copy.freeDemoBannerCta}
        <ArrowRight weight="bold" size={14} aria-hidden />
      </Link>
    </section>
  )
}

function hasDemoCookie(): boolean {
  return document.cookie.split(';').some((c) => c.trim().startsWith(`${DEMO_COOKIE_NAME}=`))
}
