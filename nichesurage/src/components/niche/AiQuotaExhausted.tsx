'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Hourglass, Sparkle } from '@phosphor-icons/react/dist/ssr'
import type { CopyKeys } from '@/components/landing/copy'

interface AiQuotaExhaustedProps {
  resetAt: Date
  copy: CopyKeys
}

// Sprint A.7 — rendered by HealthCheckInline + AIContentAngles when the API
// returns 429 daily_limit. Distinct from the FREE-tier locked teaser: this
// is for BASIC users who've already used their 1 daily deep-dive. Body
// surfaces the time-to-reset and the upgrade CTA to Premium.
export function AiQuotaExhausted({ resetAt, copy }: AiQuotaExhaustedProps) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 60 * 1000) // minute is enough resolution
    return () => window.clearInterval(id)
  }, [])

  const ms = now ? Math.max(0, resetAt.getTime() - now.getTime()) : null
  const hours = ms !== null ? Math.floor(ms / (60 * 60 * 1000)) : null
  const minutes = ms !== null ? Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000)) : null

  // "5h 32m" / "32m" — drop the leading "0h" when we're in the last hour.
  const formatted =
    hours !== null && minutes !== null
      ? hours > 0
        ? `${hours}h ${minutes}m`
        : `${minutes}m`
      : '—'

  const body = copy.aiQuotaUsedBody.replace('{hours}', formatted)

  return (
    <section className="glass rounded-2xl p-6 mb-6 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <Sparkle weight="fill" size={14} className="text-glow-indigo" aria-hidden />
        <div className="text-[10px] font-semibold tracking-[0.22em] uppercase text-glow-indigo">
          {copy.aiQuotaUsedTitle}
        </div>
      </div>

      <div className="flex items-start gap-4 mt-3">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-glow-indigo/15 ring-1 ring-glow-indigo/40 shrink-0">
          <Hourglass weight="duotone" size={20} className="text-glow-indigo" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-slate-300 text-sm leading-relaxed mb-4">{body}</p>
          <Link
            href="/pricing"
            className="inline-block text-[13px] font-semibold px-4 py-2 rounded-lg bg-gradient-to-br from-brand-indigo to-brand-indigo-bright text-white hover:brightness-110 transition-all shadow-[0_8px_24px_-8px_rgba(124,131,240,0.45)]"
          >
            {copy.aiQuotaUpgradeCta}
          </Link>
        </div>
      </div>
    </section>
  )
}
