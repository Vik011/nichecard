'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  async function handleGoogleLogin() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 w-full max-w-sm text-center">
        <div className="text-2xl font-extrabold tracking-tight text-white mb-8">
          Niche<span className="text-indigo-400">Surge</span>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Welcome to NicheSurge</h1>
        <p className="text-slate-400 text-sm mb-8">
          Sign in to discover viral YouTube niches
        </p>
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          <GoogleIcon />
          Continue with Google
        </button>
        <p className="text-slate-600 text-xs mt-5">No credit card required</p>
      </div>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.3 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9L37.2 10C33.9 7 29.2 5 24 5 12.9 5 4 13.9 4 25s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.2-2.7-.1-5z"/>
      <path fill="#FF3D00" d="M6.3 15.5l6.6 4.8C14.5 17 19 14 24 14c3 0 5.7 1.1 7.8 2.9L37.2 10C33.9 7 29.2 5 24 5c-7.5 0-14 4.1-17.7 10.5z"/>
      <path fill="#4CAF50" d="M24 45c5.2 0 9.8-1.9 13.3-5l-6.2-5.2C29.2 36.6 26.7 37.5 24 37.5c-5.3 0-9.6-3.7-11.2-8.7L6.2 34C9.8 40.1 16.4 45 24 45z"/>
      <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.5-2.4 4.6-4.5 6l6.2 5.2C41 35.8 44 30.8 44 25c0-1.3-.2-2.7-.4-5z"/>
    </svg>
  )
}
