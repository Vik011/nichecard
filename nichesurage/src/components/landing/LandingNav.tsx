'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { List, X } from '@phosphor-icons/react/dist/ssr'
import { LanguageToggle } from './LanguageToggle'
import { AvatarMenu } from './AvatarMenu'
import type { CopyKeys, Lang } from './copy'
import { useUser } from '@/lib/context/UserContext'
import { Logo } from '@/components/brand/Logo'

interface LandingNavProps {
  copy: CopyKeys
  lang: Lang
  onLangChange: (lang: Lang) => void
}

export function LandingNav({ copy, lang, onLangChange }: LandingNavProps) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { isLoggedIn, tier, email, loading: userLoading } = useUser()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? 'backdrop-blur-xl bg-charcoal-900/60 border-b border-white/[0.06]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-white hover:opacity-80 transition-opacity"
        >
          <Logo size={30} className="text-white" />
          SurgeNiche
        </Link>

        {/* Desktop links */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
          <Link href="/discover" className="hover:text-slate-100 transition-colors">
            {copy.navDiscover}
          </Link>
          <a href="#pricing" className="hover:text-slate-100 transition-colors">
            {copy.navPricing}
          </a>
          {isLoggedIn && (
            <Link href="/dashboard" className="hover:text-slate-100 transition-colors">
              {copy.navDashboard}
            </Link>
          )}
          <LanguageToggle lang={lang} onChange={onLangChange} />
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          {userLoading ? null : isLoggedIn ? (
            <>
              {/* Avatar + dropdown replaces the previous tier+email pill.
                  Tier signal moves into the avatar's ring colour; email
                  + sign-out hidden inside the dropdown so the nav row
                  carries less visual weight. Pattern matches the in-app
                  TopNav for consistency. */}
              <AvatarMenu copy={copy} email={email ?? null} tier={tier} />
              {/* Open app demoted to ghost/outlined style — was duplicating
                  the visual prominence of the hero CTA. Header version
                  stays a clear affordance but reads as secondary so the
                  hero "Open app →" remains the screen's primary action. */}
              <Link
                href="/discover"
                className={[
                  'text-[13px] font-semibold px-4 py-2 rounded-lg',
                  'text-slate-200 hover:text-white',
                  'border border-slate-700 hover:border-glow-indigo/60',
                  'bg-charcoal-900/40 hover:bg-charcoal-800/60 backdrop-blur-sm',
                  'transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow-indigo/60 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon-950',
                ].join(' ')}
              >
                {copy.navOpenApp}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-[13px] text-slate-400 hover:text-slate-100 transition-colors px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-500"
              >
                {copy.navLogin}
              </Link>
              <Link
                href="/login"
                className={[
                  'text-[13px] font-semibold px-4 py-2 rounded-lg text-white',
                  'bg-gradient-to-r from-indigo-600 to-brand-indigo-bright',
                  'shadow-[0_4px_18px_-6px_rgba(124,131,240,0.45)]',
                  'transition-[transform,box-shadow,filter] duration-200 ease-out',
                  'hover:-translate-y-[1px] hover:brightness-[1.08] hover:shadow-[0_6px_24px_-6px_rgba(124,131,240,0.6)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow-indigo/60 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon-950',
                ].join(' ')}
              >
                {copy.navCta}
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-slate-400 hover:text-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-drawer"
        >
          {menuOpen
            ? <X weight="bold" size={20} aria-hidden />
            : <List weight="bold" size={20} aria-hidden />}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div id="mobile-nav-drawer" className="md:hidden bg-slate-900 border-t border-slate-800 px-6 py-4 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-4rem)]">
          <Link href="/discover" className="text-slate-300 hover:text-white transition-colors py-2.5 block" onClick={() => setMenuOpen(false)}>
            {copy.navDiscover}
          </Link>
          <a href="#pricing" className="text-slate-300 hover:text-white transition-colors py-2.5 block" onClick={() => setMenuOpen(false)}>
            {copy.navPricing}
          </a>
          {isLoggedIn && (
            <Link href="/dashboard" className="text-slate-300 hover:text-white transition-colors py-2.5 block" onClick={() => setMenuOpen(false)}>
              {copy.navDashboard}
            </Link>
          )}
          <LanguageToggle lang={lang} onChange={onLangChange} />
          {userLoading ? null : isLoggedIn ? (
            <>
              {/* Mobile drawer keeps the tier+email inline (no avatar
                  dropdown — it'd be a menu inside a menu on mobile).
                  Standalone tier pill replaces the previous TierBadge
                  helper since AvatarMenu now owns desktop tier display. */}
              <div className="flex items-center gap-2 pt-1">
                <span
                  className={[
                    'text-[10px] font-semibold tracking-[0.18em] uppercase px-2 py-1 rounded-md',
                    tier === 'premium'
                      ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
                      : tier === 'basic'
                      ? 'bg-glow-indigo/15 text-indigo-200 ring-1 ring-glow-indigo/40'
                      : 'bg-slate-800 text-slate-400 ring-1 ring-slate-700',
                  ].join(' ')}
                >
                  {tier === 'premium'
                    ? copy.topNavTierPremium
                    : tier === 'basic'
                    ? copy.topNavTierBasic
                    : copy.topNavTierFree}
                </span>
                {email && (
                  <span className="text-sm text-slate-400 truncate" title={email}>
                    {email}
                  </span>
                )}
              </div>
              <Link
                href="/discover"
                className="text-center text-sm font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-brand-indigo-bright text-white"
                onClick={() => setMenuOpen(false)}
              >
                {copy.navOpenApp}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-slate-300 hover:text-white transition-colors text-sm py-2.5 block"
                onClick={() => setMenuOpen(false)}
              >
                {copy.navLogin}
              </Link>
              <Link
                href="/login"
                className="text-center text-sm font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-brand-indigo-bright text-white"
                onClick={() => setMenuOpen(false)}
              >
                {copy.navCta}
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}
