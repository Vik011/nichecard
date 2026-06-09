'use client'

import type { CopyKeys } from '@/components/landing/copy'
import type { NicheCardData, SpikePoint, UserTier } from '@/lib/types'
import { FreeDemoBanner } from '@/components/niche/FreeDemoBanner'
import { NicheDetailHeader } from '@/components/niche/NicheDetailHeader'
import { NicheStatsPanel } from '@/components/niche/NicheStatsPanel'
import { PerformanceChart } from '@/components/niche/PerformanceChart'
import { HealthCheckInline } from '@/components/niche/HealthCheckInline'
import { AIContentAngles } from '@/components/niche/AIContentAngles'
import { ChannelVideoGrid } from '@/components/niche/ChannelVideoGrid'
import { RelatedNiches } from '@/components/niche/RelatedNiches'
import { tierFromScore } from '@/components/niche/Sparkline'
import { useFreeDemoState } from '@/lib/demo/useFreeDemoState'

// Shared niche-detail body. Used by both the standalone /discover/niche/[id]
// page (direct URL access, bookmarks, link shares) and the in-app modal that
// opens over /discover when a user clicks a card.
//
// The component intentionally has no page chrome (no <main>, no max-width
// wrapper, no back link). Wrappers add those: the page wraps with
// max-w-6xl + main; the modal wraps with its own dialog container.
//
// Demo-niche unlock (Sprint A.9 Phase B): when the URL+cookie+pinned-id
// triple validation says this is the legitimate first-login WOW demo,
// the AI components see `effectiveTier='premium'` and render unlocked.
// The API routes for those components are also bypassed server-side
// for the same scan_id — the two layers agree, no quota burn, no spoof.

export interface NicheDetailContentProps {
  niche: NicheCardData
  history: SpikePoint[]
  tier: UserTier
  copy: CopyKeys
  /**
   * Save state forwarded to NicheDetailHeader so the heart button can
   * sit beside the "Visit on YouTube" CTA. Optional — when omitted the
   * header just doesn't render the bookmark control (fine for the very
   * first paint while the parent is still loading the saved-set).
   */
  isSaved?: boolean
  savedCount?: number
  onBookmarkToggle?: (id: string, saved: boolean) => void
  /**
   * Click handler for cards inside RelatedNiches. When provided, clicking
   * a related card swaps the modal in-place via router.replace instead of
   * close + reopen. Only the in-app modal supplies this; the standalone
   * /discover/niche/[id] page leaves it undefined so RelatedNiches falls
   * back to NicheCard's default Link navigation.
   */
  onRelatedClick?: (id: string) => void
}

export function NicheDetailContent({
  niche,
  history,
  tier,
  copy,
  isSaved,
  savedCount,
  onBookmarkToggle,
  onRelatedClick,
}: NicheDetailContentProps) {
  const demoState = useFreeDemoState(niche.id)
  // While we don't yet know whether this is the legit demo, render the
  // AI sections at the user's real tier. The auth-callback redirect for
  // brand-new free users only flips this to 'legitimate' for the actual
  // pinned scan_id; everywhere else it resolves to 'not-demo' and
  // nothing changes.
  const aiTier: UserTier = demoState === 'legitimate' && tier === 'free' ? 'premium' : tier
  // Signal for AI children to append ?demo=1 to their fetch URLs so the
  // server (Tasks 10–11) can require all three validations (param + cookie
  // + scan match) before bypassing the quota gate.
  const isLegitimateDemo = demoState === 'legitimate' && tier === 'free'

  // PR 4: catalog-only card (wl: id, no scan_results row). Render the honest
  // subset — header (no score hero / bookmark) + stats (no NaN age / 0× spike) +
  // channel videos + related. Omit every scan_result_id / score / history-driven
  // section (HealthCheckInline, AIContentAngles, PerformanceChart, FreeDemoBanner)
  // so the detail never fires bogus `wl:` API calls or shows fake metrics.
  if (niche.catalogOnly) {
    return (
      <div className="animate-fade-in">
        <NicheDetailHeader niche={niche} copy={copy} userTier={tier} catalogOnly />
        <NicheStatsPanel niche={niche} copy={copy} catalogOnly />
        <ChannelVideoGrid channelId={niche.youtubeChannelId} copy={copy} />
        <RelatedNiches niche={niche} userTier={tier} copy={copy} onCardClick={onRelatedClick} />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <FreeDemoBanner nicheId={niche.id} copy={copy} />
      <NicheDetailHeader
        niche={niche}
        copy={copy}
        userTier={tier}
        isSaved={isSaved}
        savedCount={savedCount}
        onBookmarkToggle={onBookmarkToggle}
      />
      <NicheStatsPanel niche={niche} copy={copy} />

      {/* Two-column zone on lg+ (collapses to single column below lg). */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6">
        <div className="flex flex-col">
          <PerformanceChart history={history} copy={copy} tier={tierFromScore(niche.opportunityScore)} />
          <HealthCheckInline scanResultId={niche.id} userTier={aiTier} copy={copy} isLegitimateDemo={isLegitimateDemo} />
        </div>
        <div className="flex flex-col">
          <AIContentAngles scanResultId={niche.id} userTier={aiTier} copy={copy} isLegitimateDemo={isLegitimateDemo} />
          <ChannelVideoGrid channelId={niche.youtubeChannelId} copy={copy} />
        </div>
      </div>

      <RelatedNiches niche={niche} userTier={tier} copy={copy} onCardClick={onRelatedClick} />
    </div>
  )
}
