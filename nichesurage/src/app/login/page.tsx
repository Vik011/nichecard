import { Suspense } from 'react'
import Link from 'next/link'
import { CaretLeft } from '@phosphor-icons/react/dist/ssr'
import { LoginForm } from './LoginForm'

export const metadata = { title: 'Sign in — SurgeNiche' }

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-6 relative">
      {/* Top-left back-to-home anchor. Login is an end-of-funnel page; without
          this, a user who arrived from a redirect (or middleware-protected
          route) had no way back to the marketing page short of editing the
          URL. Anchored to the page rather than the form so it stays visible
          regardless of which form state is rendered (idle / sent / error). */}
      <Link
        href="/"
        className="absolute top-6 left-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 transition-colors"
      >
        <CaretLeft weight="bold" size={14} aria-hidden />
        Back to home
      </Link>
      <Suspense fallback={<div className="text-slate-400 text-sm">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  )
}
