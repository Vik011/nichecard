'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const VALID_PLANS = new Set(['basic', 'premium'])
const VALID_INTERVALS = new Set(['monthly', 'yearly'])

export function LoginForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'magic' | 'password'>('password')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'redirecting'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const rawPlan = searchParams.get('plan')
  const rawBilling = searchParams.get('billing')
  const plan = rawPlan && VALID_PLANS.has(rawPlan) ? rawPlan : null
  const billing = rawBilling && VALID_INTERVALS.has(rawBilling) ? rawBilling : null

  async function postLoginRedirect() {
    if (plan && billing) {
      setStatus('redirecting')
      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier: plan, interval: billing }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.url) {
          window.location.href = data.url
          return
        }
        setStatus('error')
        setErrorMessage(data.error ?? `Checkout failed (${res.status})`)
        return
      } catch (e) {
        setStatus('error')
        setErrorMessage((e as Error).message)
        return
      }
    }
    router.push('/dashboard')
  }

  useEffect(() => {
    if (!plan || !billing) return
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      postLoginRedirect()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, billing])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setStatus('sending')
    setErrorMessage(null)

    const supabase = createClient()

    if (mode === 'password') {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) {
        setStatus('error')
        setErrorMessage(error.message)
        return
      }
      await postLoginRedirect()
      return
    }

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
      <h1 className="text-2xl font-semibold tracking-tight text-slate-100 mb-2">Sign in to SurgeNiche</h1>
      <p className="text-slate-400 text-sm mb-6">
        We&apos;ll email you a one-time link. No password.
      </p>

      {plan && billing && (
        <div className="mb-5 text-xs text-glow-indigo bg-charcoal-800/60 gborder rounded-lg px-3 py-2">
          After login you&apos;ll go straight to checkout for {plan === 'premium' ? 'Premium' : 'Basic'} ({billing}).
        </div>
      )}

      {status === 'redirecting' ? (
        <div className="text-slate-400 text-sm">Redirecting to checkout…</div>
      ) : status === 'sent' ? (
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
          {mode === 'password' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-slate-400 text-xs uppercase tracking-[0.18em]">Password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-charcoal-900 gborder rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-glow-indigo"
                placeholder="••••••••"
              />
            </label>
          )}
          <button
            type="submit"
            disabled={status === 'sending' || !email || (mode === 'password' && !password)}
            className="text-[15px] font-semibold px-5 py-2.5 rounded-xl bg-gradient-to-br from-brand-indigo to-brand-indigo-bright hover:brightness-110 hover:shadow-glow-cyan transition-all text-white disabled:opacity-50"
          >
            {status === 'sending'
              ? 'Signing in…'
              : mode === 'password'
              ? 'Sign in'
              : 'Send magic link'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'password' ? 'magic' : 'password')
              setErrorMessage(null)
            }}
            className="text-slate-400 hover:text-slate-200 text-xs underline-offset-4 hover:underline self-start"
          >
            {mode === 'password' ? 'Use magic link instead' : 'Use password instead'}
          </button>
          {errorMessage && (
            <div className="text-red-400 text-xs">{errorMessage}</div>
          )}
        </form>
      )}
    </div>
  )
}
