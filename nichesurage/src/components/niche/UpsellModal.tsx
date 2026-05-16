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
  // Both CTAs route to the landing pricing section. There is no dedicated
  // /pricing page (was a 404 footgun before 2026-05-07); the canonical
  // pricing surface is the `#pricing` section on `/`.
  const ctaHref = '/#pricing'

  // Tier-aware accent. The basic→premium variant wears the Premium accent
  // (indigo canvas + gold, per DESIGN.md §Premium-tier accent). The
  // free→basic variant keeps the dashboard glass + emerald: indigo and gold
  // are reserved for the Premium tier, and free→basic targets Basic, whose
  // color is emerald. Both variants share the same polished structure
  // (wide soft shadow, stronger backdrop blur, quiet secondary button).
  const theme = isBasic
    ? {
        panel:
          'bg-gradient-to-b from-premium-canvas to-premium-canvas-deep premium-modal-glow',
        hairline: true,
        iconChip: 'bg-white/5 ring-1 ring-white/10',
        icon: 'text-premium-gold',
        title: 'text-premium-ink',
        body: 'text-premium-ink-muted',
        cta: 'bg-premium-gold text-premium-canvas-deep hover:bg-premium-gold-bright hover:-translate-y-px',
        secondary: 'text-premium-ink-muted/55 hover:text-premium-ink-muted',
      }
    : {
        panel:
          'glass ring-1 ring-emerald-500/30 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.7)]',
        hairline: false,
        iconChip: 'bg-emerald-500/10 ring-1 ring-emerald-500/30',
        icon: 'text-emerald-300',
        title: 'text-slate-100',
        body: 'text-slate-400',
        cta: 'bg-white text-charcoal-900 hover:bg-slate-100',
        secondary: 'text-slate-500 hover:text-slate-300',
      }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      {/* Backdrop — stronger blur than before so the modal reads as a
          focused, separate layer. */}
      <button
        type="button"
        aria-label="Close upsell"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
      />

      <div
        ref={dialogRef}
        className={`relative w-full max-w-md overflow-hidden rounded-2xl p-7 ${theme.panel}`}
      >
        {/* Gold hairline: the shared "exclusive layer" identity element.
            Only the Premium variant gets it. */}
        {theme.hairline && (
          <div
            aria-hidden
            className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-premium-gold/80 to-transparent"
          />
        )}

        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-500 hover:text-slate-200 transition-colors p-1.5"
        >
          <X weight="bold" size={16} aria-hidden />
        </button>

        <div
          className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 ${theme.iconChip}`}
        >
          <LockSimple
            weight="fill"
            size={20}
            className={theme.icon}
            aria-hidden
          />
        </div>

        <h2
          className={`text-xl font-semibold tracking-tight mb-2 ${theme.title}`}
        >
          {title}
        </h2>
        <p className={`text-sm leading-relaxed mb-6 ${theme.body}`}>{body}</p>

        <div className="flex flex-col gap-2">
          <Link
            href={ctaHref}
            className={`block w-full text-center py-3 px-4 rounded-xl font-semibold text-[15px] transition-all ${theme.cta}`}
          >
            {ctaLabel}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className={`text-[13px] py-2 transition-colors ${theme.secondary}`}
          >
            {copy.upsellSecondary}
          </button>
        </div>
      </div>
    </div>
  )
}
