import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { AdminSignOut } from '@/components/admin/AdminSignOut'

// Server-side guard. requireAdmin() throws notFound() for non-admins, so the
// /admin tree is invisible to anyone whose email isn't whitelisted. The
// layout runs on every nested route, so child pages don't need to repeat
// the gate.
//
// We intentionally do NOT render the regular TopNav here — admin shouldn't
// see the shorts/longform/saved tabs while looking at metrics. Stripped
// header keeps the page chrome out of the way.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin()

  return (
    <div className="min-h-screen bg-charcoal-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800/60 bg-charcoal-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-baseline gap-3">
            <Link href="/admin" className="text-base font-semibold tracking-tight text-slate-100">
              SurgeNiche <span className="text-emerald-300">Admin</span>
            </Link>
            <Link
              href="/discover?type=shorts"
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              ← Back to app
            </Link>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="hidden sm:inline">{user.email}</span>
            <AdminSignOut />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  )
}
