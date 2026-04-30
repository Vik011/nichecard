'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const VALID_PLANS = new Set(['basic', 'premium'])
const VALID_INTERVALS = new Set(['monthly', 'yearly'])

export function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const rawPlan = searchParams.get('plan')
  const rawBilling = searchParams.get('billing')
  const plan = rawPlan && VALID_PLANS.has(rawPlan) ? rawPlan : null
  const billing = rawBilling && VALID_INTERVALS.has(rawBilling) ? rawBilling : null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setStatus('sending')
    setErrorMessage(null)

    const supabase = createClient()
    const callback = new URL('/auth/callback', window.location.origin)
    if (plan) callback.searchParams.set('plan', plan)
    if (billing) callback.searchParams.set('billing', billing)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callback.toString() },
    })

    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
      return
    }
    setStatus('sent')
  }

  return (
    <div className="w-full max-w-md glass rounded-2xl p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-100 mb-2">Sign in to NicheSurge</h1>
      <p className="text-slate-400 text-sm mb-6">
        We&apos;ll email you a one-time link. No password.
      </p>

      {plan && billing && (
        <div className="mb-5 text-xs text-glow-violet bg-charcoal-800/60 gborder rounded-lg px-3 py-2">
          After login you&apos;ll go straight to checkout for {plan === 'premium' ? 'Premium' : 'Basic'} ({billing}).
        </div>
      )}

      {status === 'sent' ? (
        <div className="text-emerald-300 text-sm">
          Check your inbox at <span className="text-slate-100 font-medium">{email}</span>. Click the link to sign in.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-slate-400 text-xs uppercase tracking-[0.18em]">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-charcoal-900 gborder rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-glow-indigo"
              placeholder="you@example.com"
            />
          </label>
          <button
            type="submit"
            disabled={status === 'sending' || !email}
            className="text-[15px] font-semibold px-5 py-2.5 rounded-xl bg-gradient-to-br from-glow-indigo to-glow-violet hover:brightness-110 transition-all text-white disabled:opacity-50"
          >
            {status === 'sending' ? 'Sending…' : 'Send magic link'}
          </button>
          {errorMessage && (
            <div className="text-red-400 text-xs">{errorMessage}</div>
          )}
        </form>
      )}
    </div>
  )
}
