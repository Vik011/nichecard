import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapRow } from '@/lib/supabase/queries'
import { SavedNichesList } from './SavedNichesList'
import type { DbScanResult, UserTier } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileResult, savedResult] = await Promise.all([
    supabase
      .from('users')
      .select('email, tier')
      .eq('id', user.id)
      .single(),
    supabase
      .from('user_saved_niches')
      .select('scan_result_id, saved_at, scan_results(*)')
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false }),
  ])

  const profile = profileResult.data
  const tier = (profile?.tier ?? 'free') as UserTier
  const email = profile?.email ?? user.email ?? ''

  const savedNiches = (savedResult.data ?? []).map(item =>
    mapRow(item.scan_results as unknown as DbScanResult)
  )

  const tierLabel: Record<UserTier, string> = {
    free: 'Free',
    basic: 'Basic',
    premium: 'Premium ✦',
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">My Saved Niches</h1>
          <p className="text-slate-500 text-sm mt-0.5">{email}</p>
        </div>
        <div className="text-right">
          <span className="inline-block bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs font-semibold px-3 py-1 rounded-full">
            {tierLabel[tier]}
          </span>
          {tier !== 'premium' && (
            <a
              href="/login"
              className="block text-xs text-indigo-400 hover:text-indigo-300 mt-1.5"
            >
              Upgrade →
            </a>
          )}
        </div>
      </div>

      {/* Saved count */}
      <p className="text-slate-500 text-sm mb-5">
        {savedNiches.length === 0
          ? 'No saved niches'
          : `${savedNiches.length} saved niche${savedNiches.length === 1 ? '' : 's'}`}
        {tier === 'basic' && ` · ${10 - savedNiches.length} slots remaining`}
      </p>

      <SavedNichesList initialNiches={savedNiches} userTier={tier} />
    </main>
  )
}
