'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { LanguageToggle } from './LanguageToggle'
import type { CopyKeys, Lang } from './copy'
import { useUser } from '@/lib/context/UserContext'
import type { UserTier } from '@/lib/types/database'

// 3-tier badge consistent with TopNav. Previously LandingNav only had a
// 2-way ternary (premium vs everything else) which made BASIC users show as
// FREE on the landing page even though /discover correctly read them as
// BASIC — i.e. tier display was inconsistent across the app shell.
function TierBadge({ tier, copy }: { tier: UserTier; copy: CopyKeys }) {
  const isElevated = tier === 'premium' || tier === 'basic'
  const className = isElevated
    ? 'text-[10px] font-semibold tracking-[0.18em] uppercase px-2 py-1 rounded-md bg-glow-indigo/15 text-indigo-200 ring-1 ring-glow-indigo/40'
    : 'text-[10px] font-semibold tracking-[0.18em] uppercase px-2 py-1 rounded-md bg-slate-800 text-slate-400 ring-1 ring-slate-700'
  const label =
    tier === 'premium' ? copy.tierPremium : tier === 'basic' ? copy.tierBasic : copy.tierFree
  return <span className={className}>{label}</span>
}

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
          className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-brand-indigo-bright bg-clip-text text-transparent"
        >
          SurgeNiche
        </Link>

        {/* Desktop links */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
          <Link href="/discover/shorts" className="hover:text-slate-100 transition-colors">
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
              <TierBadge tier={tier} copy={copy} />
              {email && (
                <span className="text-sm text-slate-400 max-w-[180px] truncate" title={email}>
                  {email}
                </span>
              )}
              <Link
                href="/discover/shorts"
                className="text-sm font-semibold px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-brand-indigo-bright hover:from-indigo-500 hover:to-brand-indigo-bright transition-all text-white"
              >
                {copy.navOpenApp}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-slate-400 hover:text-slate-100 transition-colors px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500"
              >
                {copy.navLogin}
              </Link>
              <Link
                href="/login"
                className="text-sm font-semibold px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-brand-indigo-bright hover:from-indigo-500 hover:to-brand-indigo-bright transition-all text-white"
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
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div id="mobile-nav-drawer" className="md:hidden bg-slate-900 border-t border-slate-800 px-6 py-4 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-4rem)]">
          <Link href="/discover/shorts" className="text-slate-300 hover:text-white transition-colors py-2.5 block" onClick={() => setMenuOpen(false)}>
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
              <div className="flex items-center gap-2 pt-1">
                <TierBadge tier={tier} copy={copy} />
                {email && (
                  <span className="text-sm text-slate-400 truncate" title={email}>
                    {email}
                  </span>
                )}
              </div>
              <Link
                href="/discover/shorts"
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
