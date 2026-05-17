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
      ? 'ring-accent-emerald-bright/60 hover:ring-accent-emerald-bright/80'
      : tier === 'basic'
      ? 'ring-accent-emerald/40 hover:ring-accent-emerald/60'
      : 'ring-hairline-edge hover:ring-hairline-edge'

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
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emerald/30 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        ].join(' ')}
      >
        <span
          data-testid="user-avatar-initial"
          className={[
            'flex items-center justify-center w-9 h-9 rounded-full',
            'bg-surface-elevated text-ink text-[13px] font-semibold tracking-tight',
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
          className={`text-ink-subtle transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className={[
            'absolute right-0 mt-2 w-64',
            'rounded-xl border border-hairline-edge bg-surface-raised/95 backdrop-blur-xl',
            'shadow-[0_18px_48px_-12px_rgba(0,0,0,0.7)]',
            'p-2 z-40',
          ].join(' ')}
        >
          <div className="px-3 py-2.5 border-b border-hairline-soft mb-1">
            <div className="text-ink text-[13px] font-medium truncate">
              {email ?? '—'}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-ink-subtle text-[10px] uppercase tracking-[0.18em]">
                {labels.planLabel}
              </span>
              <span
                className={[
                  'text-[10px] font-semibold tracking-[0.18em] uppercase px-1.5 py-0.5 rounded',
                  tier === 'premium'
                    ? 'bg-accent-emerald/15 text-accent-emerald-bright ring-1 ring-accent-emerald/30'
                    : tier === 'basic'
                    ? 'bg-accent-emerald/10 text-accent-emerald-bright ring-1 ring-accent-emerald/30'
                    : 'bg-surface-overlay text-ink-muted ring-1 ring-hairline-edge',
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
              'text-[13px] text-ink-muted hover:text-ink',
              'hover:bg-white/[0.04] transition-colors',
              'disabled:opacity-60',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emerald/30',
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
