'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogoStacked } from '@/components/brand/LogoStacked'

const VALID_PLANS = new Set(['basic', 'premium'])
const VALID_INTERVALS = new Set(['monthly', 'yearly'])

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

// Cloudflare Turnstile global API. Loaded lazily by the <Script> tag below
// with `?render=explicit`, which prevents the auto-render from running before
// our React effect attaches the container ref.
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
    onloadTurnstileCallback?: () => void
  }
}

interface TurnstileRenderOptions {
  sitekey: string
  theme?: 'light' | 'dark' | 'auto'
  callback?: (token: string) => void
  'error-callback'?: () => void
  'expired-callback'?: () => void
}

// Google-only auth. We intentionally removed the email/password and magic-link
// paths in Sprint A.7 Phase 0: the freemium tier limits are tied to user_id,
// and disposable-email signups make user_id cheap to mint, which would let a
// determined user bypass the 1-reveal-per-6h FREE limit by registering N
// throwaway addresses. Google OAuth makes account creation expensive enough
// to make the abuse vector uneconomic. If a user without Google complains,
// we add Apple Sign In before re-opening email signup.
export function LoginForm() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'idle' | 'verifying' | 'redirecting' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const widgetRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)

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

  // Already-logged-in shortcut: if a Basic user clicks "Upgrade to Premium"
  // on /#pricing, the link drops them at /login?plan=premium&billing=monthly.
  // Without this effect they'd see the Sign-in form and clicking Google
  // would start a fresh OAuth flow that rotates session cookies, breaking
  // the auth-callback → /api/stripe/checkout fetch (the forwarded cookie
  // header lags the new session, the API returns 401, and the user gets
  // bounced back to /discover with no checkout). Detect the existing
  // session client-side and POST straight to /api/stripe/checkout — the
  // browser fetch carries the *current* cookies, so the API sees the user.
  useEffect(() => {
    if (!plan || !billing) return
    if (callbackError) return // surface the error, don't auto-retry

    let cancelled = false
    const supabase = createClient()
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled || !user) return
      setStatus('redirecting')
      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier: plan, interval: billing }),
        })
        if (cancelled) return
        // Always read the body — even on error responses we surface the
        // server-side reason so the user (and we, in screenshots) can see
        // exactly which validation tripped instead of a generic
        // "couldn't start checkout".
        const rawBody = await res.text().catch(() => '')
        let parsed: { url?: string; error?: string } = {}
        try {
          parsed = rawBody ? (JSON.parse(rawBody) as { url?: string; error?: string }) : {}
        } catch {
          parsed = {}
        }
        if (!res.ok) {
          setStatus('error')
          const reason = parsed.error ?? rawBody ?? `HTTP ${res.status}`
          setErrorMessage(
            `Checkout failed (${res.status}): ${reason}. If this keeps happening, email support@surgeniche.com.`,
          )
          return
        }
        if (parsed.url) {
          window.location.href = parsed.url
        } else {
          setStatus('error')
          setErrorMessage('Checkout returned no redirect URL. Please try again.')
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          const msg = err instanceof Error ? err.message : 'unknown'
          setErrorMessage(`Network error while starting checkout (${msg}). Try again.`)
        }
      }
    })
    return () => {
      cancelled = true
    }
  }, [plan, billing, callbackError])

  // Render the Turnstile widget once the script has loaded. We use explicit
  // render instead of the auto-render `class="cf-turnstile"` pattern so the
  // token state lives in React, not on a global window callback.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return

    function tryRender() {
      if (!window.turnstile || !widgetRef.current || widgetIdRef.current) return
      widgetIdRef.current = window.turnstile.render(widgetRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        callback: (token) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(null),
        'error-callback': () => setTurnstileToken(null),
      })
    }

    // If the script already loaded, render now. Otherwise the onload callback
    // (set on window below) will fire it.
    tryRender()
    window.onloadTurnstileCallback = tryRender

    return () => {
      // Clean up so re-mounts (e.g. fast refresh in dev) don't double-render.
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          // ignore — widget may already be gone
        }
        widgetIdRef.current = null
      }
    }
  }, [])

  async function handleGoogleSignIn() {
    setErrorMessage(null)

    // If Turnstile is configured but we don't have a token yet, refuse to
    // start OAuth. The button is also disabled in this state, so this is a
    // belt-and-braces guard.
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setStatus('error')
      setErrorMessage('Please complete the security check before signing in.')
      return
    }

    if (TURNSTILE_SITE_KEY && turnstileToken) {
      setStatus('verifying')
      try {
        const res = await fetch('/api/auth/turnstile/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: turnstileToken }),
        })
        if (!res.ok) {
          setStatus('error')
          setErrorMessage('Security check failed. Please refresh and try again.')
          // Reset the widget so the user can solve a fresh challenge.
          if (widgetIdRef.current && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current)
          }
          setTurnstileToken(null)
          return
        }
      } catch {
        setStatus('error')
        setErrorMessage('Network error during security check. Try again.')
        return
      }
    }

    setStatus('redirecting')
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

  const buttonDisabled =
    status === 'verifying' ||
    status === 'redirecting' ||
    (!!TURNSTILE_SITE_KEY && !turnstileToken)

  const buttonLabel =
    status === 'verifying'
      ? 'Verifying…'
      : status === 'redirecting'
      ? 'Redirecting to Google…'
      : 'Sign in with Google'

  return (
    <>
      {TURNSTILE_SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit"
          strategy="afterInteractive"
          async
          defer
        />
      )}
      <div className="w-full max-w-md glass rounded-2xl p-8">
        <div className="flex justify-center mb-7">
          <LogoStacked iconSize={64} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink mb-2 text-center">
          Sign in
        </h1>
        <p className="text-ink-muted text-sm mb-6 text-center">
          We use Google sign-in to keep accounts real. No passwords to remember.
        </p>

        {plan && billing && (
          <div className="mb-5 text-xs text-accent-emerald-bright bg-surface-elevated/60 gborder rounded-lg px-3 py-2">
            After login you&apos;ll go straight to checkout for{' '}
            {plan === 'premium' ? 'Premium' : 'Basic'} ({billing}).
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={buttonDisabled}
          className="w-full inline-flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-white text-surface-raised hover:bg-slate-100 transition-colors font-semibold text-[15px] shadow-[0_8px_24px_-8px_rgba(255,255,255,0.18)] disabled:opacity-60 disabled:cursor-wait"
        >
          <GoogleGlyph />
          {buttonLabel}
        </button>

        {/* Turnstile widget container — sized to leave room for the challenge
            iframe. The widget often runs invisibly; when it does need a UI
            (high-risk traffic), it shows here. */}
        {TURNSTILE_SITE_KEY && (
          <div
            ref={widgetRef}
            className="mt-4 flex justify-center min-h-[65px]"
            aria-label="Security check"
          />
        )}

        {errorMessage && (
          <div className="mt-4 text-red-400 text-xs" role="alert">
            {errorMessage}
          </div>
        )}

        <p className="mt-6 text-ink-subtle text-[11px] leading-relaxed">
          By signing in you agree to our{' '}
          <a href="/terms" className="underline-offset-4 hover:underline hover:text-ink-muted">
            Terms
          </a>{' '}
          and{' '}
          <a href="/privacy" className="underline-offset-4 hover:underline hover:text-ink-muted">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </>
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
