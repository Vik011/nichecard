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

// Shared niche-detail body. Used by both the standalone /discover/niche/[id]
// page (direct URL access, bookmarks, link shares) and the in-app modal that
// opens over /discover when a user clicks a card. Keeping a single source
// avoids drift between the two surfaces.
//
// The component intentionally has no page chrome (no <main>, no max-width
// wrapper, no back link). Wrappers add those: the page wraps with
// max-w-6xl + main; the modal wraps with its own dialog container.
//
// `tier` is the user's actual subscription tier; `effectiveTier` is what
// the AI-feature components see for gating purposes. They diverge in the
// first-login WOW demo flow where a free user temporarily renders as
// premium so today's pinned niche shows pre-cached AI results.

export interface NicheDetailContentProps {
  niche: NicheCardData
  history: SpikePoint[]
  tier: UserTier
  /** Tier passed to AI-feature components for gating. Defaults to `tier`. */
  effectiveTier?: UserTier
  copy: CopyKeys
}

export function NicheDetailContent({
  niche,
  history,
  tier,
  effectiveTier,
  copy,
}: NicheDetailContentProps) {
  const aiTier = effectiveTier ?? tier
  return (
    <>
      <FreeDemoBanner nicheId={niche.id} copy={copy} />
      <NicheDetailHeader niche={niche} copy={copy} />
      <NicheStatsPanel niche={niche} copy={copy} />
      <PerformanceChart history={history} copy={copy} tier={tierFromScore(niche.opportunityScore)} />
      <HealthCheckInline scanResultId={niche.id} userTier={aiTier} copy={copy} />
      <AIContentAngles scanResultId={niche.id} userTier={aiTier} copy={copy} />
      <ChannelVideoGrid channelId={niche.youtubeChannelId} copy={copy} />
      <RelatedNiches niche={niche} userTier={tier} copy={copy} />
    </>
  )
}
