'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { CaretDown, SignOut } from '@phosphor-icons/react/dist/ssr'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { useLang } from '@/lib/i18n/useLang'
import { COPY } from '@/components/landing/copy'

export function TopNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { email, tier, loading } = useUser()
  const [lang] = useLang()
  const copy = COPY[lang]

  // The shorts/longform pages are served from /discover with a ?type= param
  // (the /discover/shorts and /discover/longform routes are just redirects).
  // So active-state matching has to look at the query param too.
  const onDiscover = pathname === '/discover'
  const currentType = searchParams?.get('type') ?? 'shorts'
  const TABS: Array<{ href: string; label: string; isActive: boolean }> = [
    {
      href: '/discover?type=shorts',
      label: copy.topNavShorts,
      isActive: onDiscover && currentType !== 'longform',
    },
    {
      href: '/discover?type=longform',
      label: copy.topNavLongform,
      isActive: onDiscover && currentType === 'longform',
    },
    {
      href: '/dashboard',
      label: copy.topNavSaved,
      isActive: pathname === '/dashboard',
    },
  ]
  const [menuOpen, setMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      window.addEventListener('mousedown', onClick)
      return () => window.removeEventListener('mousedown', onClick)
    }
  }, [menuOpen])

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-slate-950/70 border-b border-slate-800/60">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-slate-100 font-bold tracking-tight text-base hover:text-indigo-300 transition-colors"
        >
          SurgeNiche
        </Link>

        <nav className="flex items-center gap-1" aria-label="Primary">
          {TABS.map(({ href, label, isActive }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-[0_0_18px_-4px_rgba(99,102,241,0.55)]'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="User menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-slate-100 px-2 py-1 rounded-lg transition-colors"
          >
            <span className="hidden sm:inline truncate max-w-[160px]">
              {loading ? '…' : (email ?? copy.topNavAccount)}
            </span>
            <CaretDown weight="bold" size={12} aria-hidden />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 glass rounded-xl p-2 shadow-xl z-40"
            >
              <div className="px-3 py-2 border-b border-slate-800/60 mb-1">
                <div className="text-slate-200 text-xs font-medium truncate">{email ?? '—'}</div>
                <div className="text-slate-500 text-[10px] uppercase tracking-[0.18em] mt-0.5">
                  {tier === 'free' ? copy.topNavTierFree : tier === 'basic' ? copy.topNavTierBasic : copy.topNavTierPremium}
                </div>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors disabled:opacity-60"
              >
                <SignOut weight="bold" size={14} aria-hidden />
                {signingOut ? copy.topNavSigningOut : copy.topNavSignOut}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
