import { Suspense } from 'react'
import { LoginForm } from './LoginForm'

export const metadata = { title: 'Sign in — SurgeNiche' }

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
      <Suspense fallback={<div className="text-slate-400 text-sm">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  )
}
