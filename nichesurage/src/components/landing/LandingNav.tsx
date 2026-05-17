'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { List, X } from '@phosphor-icons/react/dist/ssr'
import { LanguageToggle } from './LanguageToggle'
import { UserAvatarMenu } from '@/components/user/UserAvatarMenu'
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
          ? 'backdrop-blur-xl bg-surface-raised/60 border-b border-hairline-soft'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-ink hover:opacity-80 transition-opacity"
        >
          <Logo size={30} className="text-white" />
          SurgeNiche
        </Link>

        {/* Desktop links */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-ink-muted">
          <Link href="/discover" className="hover:text-ink transition-colors">
            {copy.navDiscover}
          </Link>
          <a href="#pricing" className="hover:text-ink transition-colors">
            {copy.navPricing}
          </a>
          {isLoggedIn && (
            <Link href="/dashboard" className="hover:text-ink transition-colors">
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
              <UserAvatarMenu
                email={email ?? null}
                tier={tier}
                labels={{
                  openMenu: copy.avatarMenuOpen,
                  planLabel: copy.avatarMenuPlan,
                  tierFree: copy.topNavTierFree,
                  tierBasic: copy.topNavTierBasic,
                  tierPremium: copy.topNavTierPremium,
                  signOut: copy.topNavSignOut,
                  signingOut: copy.topNavSigningOut,
                }}
              />
              {/* Open app demoted to ghost/outlined style — was duplicating
                  the visual prominence of the hero CTA. Header version
                  stays a clear affordance but reads as secondary so the
                  hero "Open app →" remains the screen's primary action. */}
              <Link
                href="/discover"
                className={[
                  'text-[13px] font-semibold px-4 py-2 rounded-lg',
                  'text-ink hover:text-ink',
                  'border border-hairline-edge',
                  'bg-surface-raised/40 hover:bg-surface-elevated/60 backdrop-blur-sm',
                  'transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emerald/30 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
                ].join(' ')}
              >
                {copy.navOpenApp}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-[13px] text-ink-muted hover:text-ink transition-colors px-3 py-2 rounded-lg border border-hairline-edge hover:bg-surface-hover"
              >
                {copy.navLogin}
              </Link>
              <Link
                href="/login"
                className={[
                  'text-[13px] font-semibold px-4 py-2 rounded-lg text-surface-raised',
                  'bg-white hover:bg-slate-100',
                  'shadow-[0_4px_14px_-4px_rgba(0,0,0,0.25)]',
                  'transition-[transform,box-shadow] duration-200 ease-out',
                  'hover:-translate-y-[1px] hover:shadow-[0_6px_18px_-4px_rgba(0,0,0,0.3)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emerald/30 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
                ].join(' ')}
              >
                {copy.navCta}
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-ink-muted hover:text-ink min-h-[44px] min-w-[44px] flex items-center justify-center"
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
        <div id="mobile-nav-drawer" className="md:hidden bg-surface-elevated border-t border-hairline-edge px-6 py-4 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-4rem)]">
          <Link href="/discover" className="text-ink-muted hover:text-ink transition-colors py-2.5 block" onClick={() => setMenuOpen(false)}>
            {copy.navDiscover}
          </Link>
          <a href="#pricing" className="text-ink-muted hover:text-ink transition-colors py-2.5 block" onClick={() => setMenuOpen(false)}>
            {copy.navPricing}
          </a>
          {isLoggedIn && (
            <Link href="/dashboard" className="text-ink-muted hover:text-ink transition-colors py-2.5 block" onClick={() => setMenuOpen(false)}>
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
                      ? 'bg-accent-emerald/15 text-accent-emerald-bright ring-1 ring-accent-emerald/30'
                      : tier === 'basic'
                      ? 'bg-surface-overlay text-ink-muted ring-1 ring-hairline-edge'
                      : 'bg-surface-overlay text-ink-muted ring-1 ring-hairline-edge',
                  ].join(' ')}
                >
                  {tier === 'premium'
                    ? copy.topNavTierPremium
                    : tier === 'basic'
                    ? copy.topNavTierBasic
                    : copy.topNavTierFree}
                </span>
                {email && (
                  <span className="text-sm text-ink-muted truncate" title={email}>
                    {email}
                  </span>
                )}
              </div>
              <Link
                href="/discover"
                className="text-center text-sm font-semibold px-4 py-2 rounded-lg bg-white text-surface-raised hover:bg-slate-100"
                onClick={() => setMenuOpen(false)}
              >
                {copy.navOpenApp}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-ink-muted hover:text-ink transition-colors text-sm py-2.5 block"
                onClick={() => setMenuOpen(false)}
              >
                {copy.navLogin}
              </Link>
              <Link
                href="/login"
                className="text-center text-sm font-semibold px-4 py-2 rounded-lg bg-white text-surface-raised hover:bg-slate-100"
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
