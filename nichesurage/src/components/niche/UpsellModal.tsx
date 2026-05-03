'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { LockSimple, X } from '@phosphor-icons/react/dist/ssr'
import type { UserTier } from '@/lib/types'
import type { CopyKeys } from '@/components/landing/copy'

interface UpsellModalProps {
  /** Tier the current user is on. Determines which CTA we show. */
  tier: UserTier
  copy: CopyKeys
  onClose: () => void
}

// Sprint A.7 — opens when a FREE or BASIC user clicks a paywalled (blurred)
// niche card. We deliberately keep the user on /discover (modal, not nav)
// so the surrounding visible-but-locked cards continue to do their FOMO
// work behind the dialog. PREMIUM never sees this modal because their
// cards aren't paywalled.
export function UpsellModal({ tier, copy, onClose }: UpsellModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Escape closes; click outside the dialog also closes (handled by the
  // backdrop button below). Keeping the focus-trap minimal — full a11y
  // polish can come later, the priority right now is the conversion CTA.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // PREMIUM shouldn't ever reach this — guard rather than render an
  // empty/broken state.
  if (tier === 'premium') return null

  const isBasic = tier === 'basic'
  const title = isBasic ? copy.upsellTitleBasic : copy.upsellTitleFree
  const body = isBasic ? copy.upsellBodyBasic : copy.upsellBodyFree
  const ctaLabel = isBasic ? copy.upsellCtaBasic : copy.upsellCtaFree
  // Both CTAs route to /pricing where the user picks plan + billing; that
  // page is the single source of truth for tier prices.
  const ctaHref = '/pricing'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close upsell"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div
        ref={dialogRef}
        className="relative w-full max-w-md glass rounded-2xl p-7 ring-1 ring-glow-indigo/40 shadow-[0_30px_80px_-20px_rgba(124,131,240,0.6)]"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-500 hover:text-slate-200 transition-colors p-1.5"
        >
          <X weight="bold" size={16} aria-hidden />
        </button>

        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-glow-indigo/15 ring-1 ring-glow-indigo/40 mb-4">
          <LockSimple weight="fill" size={20} className="text-glow-indigo" aria-hidden />
        </div>

        <h2 className="text-xl font-semibold tracking-tight text-slate-100 mb-2">
          {title}
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-6">{body}</p>

        <div className="flex flex-col gap-2">
          <Link
            href={ctaHref}
            className="block w-full text-center py-3 px-4 rounded-xl font-semibold text-[15px] bg-gradient-to-br from-brand-indigo to-brand-indigo-bright text-white hover:brightness-110 hover:shadow-glow-cyan transition-all shadow-[0_8px_24px_-6px_rgba(124,131,240,0.45)]"
          >
            {ctaLabel}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-sm py-2 transition-colors"
          >
            {copy.upsellSecondary}
          </button>
        </div>
      </div>
    </div>
  )
}
