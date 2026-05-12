'use client'

import { useEffect, useRef, useState } from 'react'
import { CaretDown, SignOut } from '@phosphor-icons/react/dist/ssr'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserTier } from '@/lib/types/database'

/**
 * Shared user-identity affordance: avatar circle with the user's first
 * initial, tier-aware ring colour, caret, and a dropdown that contains
 * the full email, the tier label, and a sign-out action.
 *
 * Surfaces: LandingNav (desktop CTAs), TopNav (in-app header).
 *
 * Mobile drawers (LandingNav has one) render the inline tier+email pill
 * directly — putting a dropdown inside a drawer becomes a menu inside a
 * menu. This component is intended for desktop nav rows.
 */

interface UserAvatarMenuLabels {
  openMenu: string
  planLabel: string
  tierFree: string
  tierBasic: string
  tierPremium: string
  signOut: string
  signingOut: string
}

interface UserAvatarMenuProps {
  email: string | null
  tier: UserTier
  labels: UserAvatarMenuLabels
}

export function UserAvatarMenu({ email, tier, labels }: UserAvatarMenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const initial = (email?.[0] ?? '?').toUpperCase()

  const tierRing =
    tier === 'premium'
      ? 'ring-emerald-400/60 hover:ring-emerald-400/80'
      : tier === 'basic'
      ? 'ring-emerald-500/40 hover:ring-emerald-500/60'
      : 'ring-slate-700 hover:ring-slate-500'

  const tierLabel =
    tier === 'premium'
      ? labels.tierPremium
      : tier === 'basic'
      ? labels.tierBasic
      : labels.tierFree

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={labels.openMenu}
        className={[
          'flex items-center gap-1 rounded-full p-0.5 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon-950',
        ].join(' ')}
      >
        <span
          data-testid="user-avatar-initial"
          className={[
            'flex items-center justify-center w-9 h-9 rounded-full',
            'bg-charcoal-800 text-slate-200 text-[13px] font-semibold tracking-tight',
            'ring-2 transition-colors',
            tierRing,
          ].join(' ')}
          aria-hidden
        >
          {initial}
        </span>
        <CaretDown
          weight="bold"
          size={11}
          aria-hidden
          className={`text-slate-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className={[
            'absolute right-0 mt-2 w-64',
            'rounded-xl border border-white/[0.08] bg-charcoal-900/95 backdrop-blur-xl',
            'shadow-[0_18px_48px_-12px_rgba(0,0,0,0.7)]',
            'p-2 z-40',
          ].join(' ')}
        >
          <div className="px-3 py-2.5 border-b border-white/[0.06] mb-1">
            <div className="text-slate-200 text-[13px] font-medium truncate">
              {email ?? '—'}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-slate-500 text-[10px] uppercase tracking-[0.18em]">
                {labels.planLabel}
              </span>
              <span
                className={[
                  'text-[10px] font-semibold tracking-[0.18em] uppercase px-1.5 py-0.5 rounded',
                  tier === 'premium'
                    ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
                    : tier === 'basic'
                    ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 ring-1 ring-slate-700',
                ].join(' ')}
              >
                {tierLabel}
              </span>
            </div>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className={[
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
              'text-[13px] text-slate-300 hover:text-white',
              'hover:bg-white/[0.04] transition-colors',
              'disabled:opacity-60',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30',
            ].join(' ')}
          >
            <SignOut weight="bold" size={14} aria-hidden />
            {signingOut ? labels.signingOut : labels.signOut}
          </button>
        </div>
      )}
    </div>
  )
}
