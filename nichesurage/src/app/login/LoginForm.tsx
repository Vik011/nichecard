'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const VALID_PLANS = new Set(['basic', 'premium'])
const VALID_INTERVALS = new Set(['monthly', 'yearly'])

// Google-only auth. We intentionally removed the email/password and magic-link
// paths in Sprint A.7 Phase 0: the freemium tier limits are tied to user_id,
// and disposable-email signups make user_id cheap to mint, which would let a
// determined user bypass the 1-reveal-per-6h FREE limit by registering N
// throwaway addresses. Google OAuth makes account creation expensive enough
// to make the abuse vector uneconomic. If a user without Google complains,
// we add Apple Sign In before re-opening email signup.
export function LoginForm() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'idle' | 'redirecting' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const rawPlan = searchParams.get('plan')
  const rawBilling = searchParams.get('billing')
  const plan = rawPlan && VALID_PLANS.has(rawPlan) ? rawPlan : null
  const billing = rawBilling && VALID_INTERVALS.has(rawBilling) ? rawBilling : null

  // Surface auth callback errors that bounced back via ?error=...
  const callbackError = searchParams.get('error')
  useEffect(() => {
    if (callbackError) {
      setStatus('error')
      setErrorMessage(decodeURIComponent(callbackError))
    }
  }, [callbackError])

  async function handleGoogleSignIn() {
    setStatus('redirecting')
    setErrorMessage(null)

    const supabase = createClient()

    // Forward plan + billing through OAuth so the callback route can run the
    // Stripe Checkout redirect after session exchange.
    const callback = new URL('/auth/callback', window.location.origin)
    if (plan) callback.searchParams.set('plan', plan)
    if (billing) callback.searchParams.set('billing', billing)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callback.toString(),
      },
    })

    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
      return
    }
    // On success the browser is being redirected to Google by Supabase —
    // we don't get a chance to render anything else. The "redirecting" state
    // is just a guard against double-clicks.
  }

  return (
    <div className="w-full max-w-md glass rounded-2xl p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-100 mb-2">
        Sign in to SurgeNiche
      </h1>
      <p className="text-slate-400 text-sm mb-6">
        We use Google sign-in to keep accounts real. No passwords to remember.
      </p>

      {plan && billing && (
        <div className="mb-5 text-xs text-glow-indigo bg-charcoal-800/60 gborder rounded-lg px-3 py-2">
          After login you&apos;ll go straight to checkout for{' '}
          {plan === 'premium' ? 'Premium' : 'Basic'} ({billing}).
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={status === 'redirecting'}
        className="w-full inline-flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-white text-slate-900 hover:bg-slate-100 transition-colors font-semibold text-[15px] shadow-[0_8px_24px_-8px_rgba(255,255,255,0.18)] disabled:opacity-60 disabled:cursor-wait"
      >
        <GoogleGlyph />
        {status === 'redirecting' ? 'Redirecting to Google…' : 'Sign in with Google'}
      </button>

      {errorMessage && (
        <div className="mt-4 text-red-400 text-xs" role="alert">
          {errorMessage}
        </div>
      )}

      <p className="mt-6 text-slate-500 text-[11px] leading-relaxed">
        By signing in you agree to our{' '}
        <a href="/terms" className="underline-offset-4 hover:underline hover:text-slate-300">
          Terms
        </a>{' '}
        and{' '}
        <a href="/privacy" className="underline-offset-4 hover:underline hover:text-slate-300">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  )
}

// Inline brand glyph — keeping it as SVG so we don't pull in another icon
// dependency for a single mark, and so the colors don't get themed away.
function GoogleGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.71H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}
