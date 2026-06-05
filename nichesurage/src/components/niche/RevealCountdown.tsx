'use client'

import { useEffect, useState } from 'react'
import { Hourglass } from '@phosphor-icons/react/dist/ssr'
import type { UserTier } from '@/lib/types'
import type { CopyKeys } from '@/components/landing/copy'
import { getMsUntilNextReveal, getNextRevealAt } from '@/lib/tier/reveal'

interface RevealCountdownProps {
  tier: UserTier
  copy: CopyKeys
  /**
   * Actual number of unlocked niches for the FREE viewer (revealedIds.size).
   * The badge must reflect this, never a static claim: when the daily pin is
   * momentarily unavailable the reveal set is empty, and the banner must not
   * claim "1 of 1 unlocked". Ignored for BASIC/PREMIUM. Defaults to 1 so any
   * caller that has not yet been plumbed keeps the historical free copy.
   */
  revealedCount?: number
  /**
   * True while the daily pin is still being resolved (the /api/demo/today id
   * fetch and, if present, the niche fetch). While pending, the badge shows a
   * neutral "checking" message instead of flashing "0 of 1" before the pin
   * lands. Ignored for BASIC/PREMIUM.
   */
  revealPending?: boolean
}

// Sprint A.7 — small inline countdown shown above the niche grid for FREE
// users. It anchors the dopamine loop ("come back tomorrow for a fresh
// reveal") and visually telegraphs that the rotation is real, not a static
// blur. BASIC and PREMIUM see a static badge instead — they don't rotate
// on a daily schedule, their feed continuously reflects the latest scan.
export function RevealCountdown({
  tier,
  copy,
  revealedCount = 1,
  revealPending = false,
}: RevealCountdownProps) {
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

  // Honest badge: while the pin is still resolving show a neutral "checking"
  // state (avoids a "0 of 1" flash that reads like a bug); once settled, claim
  // the unlock only when the reveal set actually holds it, else "0 of 1".
  const freeBadge = revealPending
    ? copy.revealCheckingBadge
    : revealedCount >= 1
      ? copy.revealFreeBadge
      : copy.revealFreeBadgeNone

  return (
    <div className="inline-flex items-center gap-2 bg-surface-raised/70 gborder rounded-full px-3 py-1.5 text-[12px] backdrop-blur-md">
      <Hourglass weight="duotone" size={13} className="text-accent-emerald-bright" aria-hidden />
      <span className="text-ink-muted uppercase tracking-[0.18em] text-[10px] font-semibold">
        {copy.revealNextLabel}
      </span>
      <span className="text-ink font-semibold tabular-nums">{formatted}</span>
      <span className="text-ink-subtle">·</span>
      <span className="text-ink-subtle text-[11px]">{freeBadge}</span>
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
      ? 'bg-accent-emerald/10 text-accent-emerald-bright ring-1 ring-accent-emerald/30'
      : 'bg-surface-raised/70 text-ink-muted gborder'
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] backdrop-blur-md ${cls}`}
    >
      <span className="text-[11px] font-semibold tracking-tight">{label}</span>
    </div>
  )
}
