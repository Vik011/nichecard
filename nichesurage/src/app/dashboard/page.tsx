import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapRow } from '@/lib/supabase/queries'
import { getAllowedChannelIds } from '@/lib/discover/channelGate'
import { SavedNichesList } from './SavedNichesList'
import { ManageSubscriptionButton } from './ManageSubscriptionButton'
import type { DbScanResult, UserTier } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileResult, savedResult] = await Promise.all([
    supabase
      .from('users')
      .select('email, tier, stripe_subscription_id')
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
  const hasSubscription = Boolean(profile?.stripe_subscription_id)

  // Gate saved niches through the same faceless/active/not-evicted set every other
  // in-app surface uses. user_saved_niches pins scan_results indefinitely (0015
  // retention never prunes saved rows), so a channel that later gets
  // YouTube-terminated and auto-evicted would otherwise still render here as a
  // "live" card with stale metrics and a dead YouTube link. Fail-closed: a gate
  // error returns [] → no stale rows shown.
  const allowedSet = new Set(await getAllowedChannelIds(supabase))
  const savedNiches = (savedResult.data ?? [])
    .map(item => mapRow(item.scan_results as unknown as DbScanResult))
    .filter(niche => allowedSet.has(niche.youtubeChannelId))

  const tierLabel: Record<UserTier, string> = {
    free: 'Free',
    basic: 'Basic',
    premium: 'Premium ✦',
  }

  return (
    <main className="min-h-screen bg-canvas text-ink px-4 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">My Channels</h1>
          <p className="text-ink-subtle text-sm mt-0.5">{email}</p>
        </div>
        <div className="text-right">
          <span className="inline-block bg-surface-elevated border border-hairline-edge text-ink-muted text-xs font-semibold px-3 py-1 rounded-full">
            {tierLabel[tier]}
          </span>
          {tier !== 'premium' && (
            <a
              href="/#pricing"
              className="block text-xs text-ink-muted hover:text-ink mt-1.5"
            >
              Upgrade →
            </a>
          )}
          {hasSubscription && (
            <ManageSubscriptionButton />
          )}
        </div>
      </div>

      {/* Saved count */}
      <p className="text-ink-subtle text-sm mb-5 max-w-2xl mx-auto">
        {savedNiches.length === 0
          ? 'No saved niches'
          : `${savedNiches.length} saved niche${savedNiches.length === 1 ? '' : 's'}`}
        {tier === 'basic' && ` · ${10 - savedNiches.length} slots remaining`}
      </p>

      <SavedNichesList initialNiches={savedNiches} userTier={tier} />
    </main>
  )
}
