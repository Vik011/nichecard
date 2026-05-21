'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
}

// v1 (Phase 0b): two routes. Phase 1+ appends entries here.
const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/setup-totp', label: 'Setup TOTP' },
]

export function AdminNav() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Admin sections"
      className="border-b border-hairline-edge/60 bg-canvas/60"
    >
      <div className="mx-auto flex max-w-7xl gap-1 px-6">
        {NAV_ITEMS.map((item) => {
          // Exact match for the root /admin entry so it doesn't light up on
          // every deeper /admin/* page. Sub-routes use startsWith semantics.
          const isActive =
            item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={
                isActive
                  ? 'border-b-2 border-accent-emerald-bright px-3 py-3 text-sm font-medium text-ink'
                  : 'border-b-2 border-transparent px-3 py-3 text-sm text-ink-muted hover:text-ink'
              }
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
