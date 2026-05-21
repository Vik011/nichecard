import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { AdminSignOut } from '@/components/admin/AdminSignOut'
import { AdminNav } from '@/components/admin/AdminNav'

// Server-side guard. requireAdmin() throws notFound() for non-admins, so the
// /admin tree is invisible to anyone whose email isn't whitelisted. The
// layout runs on every nested route, so child pages don't need to repeat
// the gate.
//
// Enrollment gate (TOTP not yet set up) is NOT in this layout — Next 14
// layouts don't have reliable pathname access, and putting the redirect
// here would loop on /admin/setup-totp. Each child page calls
// requireEnrollment() instead (see /admin/page.tsx). /admin/setup-totp
// intentionally skips it because it IS the destination.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin()

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-hairline-edge/60 bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-baseline gap-3">
            <Link href="/admin" className="text-base font-semibold tracking-tight text-ink">
              SurgeNiche <span className="text-accent-emerald-bright">Admin</span>
            </Link>
            <Link
              href="/discover?type=shorts"
              className="text-xs text-ink-subtle hover:text-ink-muted"
            >
              ← Back to app
            </Link>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-muted">
            <span className="hidden sm:inline">{user.email}</span>
            <AdminSignOut />
          </div>
        </div>
      </header>
      <AdminNav />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  )
}
