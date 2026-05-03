'use client'

import { useEffect, useState } from 'react'
import { Hourglass } from '@phosphor-icons/react/dist/ssr'
import type { UserTier } from '@/lib/types'
import type { CopyKeys } from '@/components/landing/copy'
import { getMsUntilNextReveal, getNextRevealAt } from '@/lib/tier/reveal'

interface RevealCountdownProps {
  tier: UserTier
  copy: CopyKeys
}

// Sprint A.7 — small inline countdown shown above the niche grid for FREE
// users. It anchors the dopamine loop ("come back in 4h 22m for a fresh
// reveal") and visually telegraphs that the rotation is real, not a static
// blur. BASIC and PREMIUM see a static badge instead — they don't rotate
// on a 6h schedule, their feed continuously reflects the latest scan.
export function RevealCountdown({ tier, copy }: RevealCountdownProps) {
  // We init to null so the first render on the server matches the first
  // render on the client (useEffect populates the value after mount).
  // Avoids a hydration mismatch from new Date() running at slightly
  // different instants on each side.
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  if (tier === 'premium') {
    return <StaticBadge label={copy.revealPremiumBadge} variant="premium" />
  }
  if (tier === 'basic') {
    return <StaticBadge label={copy.revealBasicBadge} variant="basic" />
  }

  // free
  if (!now) {
    // Pre-mount placeholder of the same height so the surrounding layout
    // doesn't shift when the timer hydrates.
    return <div className="h-9" aria-hidden />
  }

  const ms = getMsUntilNextReveal(tier, now)
  const at = getNextRevealAt(tier, now)
  if (ms === null || at === null) return null

  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60

  // Format: "Hh Mm Ss" — drop the leading "0h" when we're inside the last
  // hour so the badge stays compact.
  const formatted =
    h > 0
      ? `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
      : `${m}m ${s.toString().padStart(2, '0')}s`

  return (
    <div className="inline-flex items-center gap-2 bg-charcoal-900/70 gborder rounded-full px-3 py-1.5 text-[12px] backdrop-blur-md">
      <Hourglass weight="duotone" size={13} className="text-glow-indigo" aria-hidden />
      <span className="text-slate-400 uppercase tracking-[0.18em] text-[10px] font-semibold">
        {copy.revealNextLabel}
      </span>
      <span className="text-slate-100 font-semibold tabular-nums">{formatted}</span>
      <span className="text-slate-600">·</span>
      <span className="text-slate-500 text-[11px]">{copy.revealFreeBadge}</span>
    </div>
  )
}

function StaticBadge({
  label,
  variant,
}: {
  label: string
  variant: 'basic' | 'premium'
}) {
  const cls =
    variant === 'premium'
      ? 'bg-glow-indigo/15 text-indigo-200 ring-1 ring-glow-indigo/40'
      : 'bg-charcoal-900/70 text-slate-300 gborder'
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] backdrop-blur-md ${cls}`}
    >
      <span className="text-[11px] font-semibold tracking-tight">{label}</span>
    </div>
  )
}
