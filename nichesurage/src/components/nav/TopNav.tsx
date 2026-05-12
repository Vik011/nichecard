'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useUser } from '@/lib/context/UserContext'
import { useLang } from '@/lib/i18n/useLang'
import { COPY } from '@/components/landing/copy'
import { Logo } from '@/components/brand/Logo'
import { UserAvatarMenu } from '@/components/user/UserAvatarMenu'

export function TopNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { email, tier, loading } = useUser()
  const [lang] = useLang()
  const copy = COPY[lang]

  // Unified Discover surface (no shorts/longform tab split). Shorts and
  // longform now coexist in one grid with a per-card ContentTypeBadge.
  // Saved niches surface kept on /dashboard but renamed "My Channels".
  void searchParams // intentionally unused after the type-tab removal
  const onDiscover = pathname === '/discover' || pathname?.startsWith('/discover/')
  const TABS: Array<{ href: string; label: string; isActive: boolean }> = [
    {
      href: '/discover',
      label: copy.discoverNav,
      isActive: Boolean(onDiscover),
    },
    {
      href: '/dashboard',
      label: copy.myChannelsNav,
      isActive: pathname === '/dashboard',
    },
  ]

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-slate-950/70 border-b border-slate-800/60">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-white font-bold tracking-tight text-base hover:opacity-80 transition-opacity"
        >
          <Logo size={26} className="text-white" />
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
                  ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {loading ? (
          <div className="w-9 h-9 rounded-full bg-charcoal-800 ring-2 ring-slate-700 animate-pulse" aria-hidden />
        ) : (
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
        )}
      </div>
    </header>
  )
}
