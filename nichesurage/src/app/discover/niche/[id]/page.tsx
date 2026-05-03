'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { CaretLeft } from '@phosphor-icons/react/dist/ssr'
import { fetchNicheById, fetchSpikeHistory } from '@/lib/supabase/queries'
import { useUser } from '@/lib/context/UserContext'
import { useLang } from '@/lib/i18n/useLang'
import { COPY } from '@/components/landing/copy'
import { NicheDetailHeader } from '@/components/niche/NicheDetailHeader'
import { NicheStatsPanel } from '@/components/niche/NicheStatsPanel'
import { PerformanceChart } from '@/components/niche/PerformanceChart'
import { HealthCheckInline } from '@/components/niche/HealthCheckInline'
import { AIContentAngles } from '@/components/niche/AIContentAngles'
import { ChannelVideoGrid } from '@/components/niche/ChannelVideoGrid'
import { RelatedNiches } from '@/components/niche/RelatedNiches'
import { tierFromScore } from '@/components/niche/Sparkline'
import { EmptyState } from '@/components/ui/EmptyState'
import { EmptyMagnifier } from '@/components/ui/illustrations/EmptyMagnifier'
import type { NicheCardData, SpikePoint } from '@/lib/types'
import type { CopyKeys } from '@/components/landing/copy'

export default function NicheDetailPage() {
  const params = useParams<{ id: string }>()
  const sp = useSearchParams()
  const { tier, loading: userLoading } = useUser()
  const [lang] = useLang()
  const copy = COPY[lang]

  const [niche, setNiche] = useState<NicheCardData | null>(null)
  const [history, setHistory] = useState<SpikePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!params.id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      const n = await fetchNicheById(params.id)
      if (cancelled) return
      if (!n) { setError(copy.detailNotFound); setLoading(false); return }
      setNiche(n)
      const h = await fetchSpikeHistory(n.youtubeChannelId)
      if (cancelled) return
      setHistory(h)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [params.id, copy.detailNotFound])

  const fromParam = sp?.get('from') ?? null
  const fallbackBack = niche?.contentType === 'longform' ? '/discover/longform' : '/discover/shorts'
  const backHref = fromParam && fromParam.startsWith('/') ? fromParam : fallbackBack

  if (loading || userLoading) return <DetailSkeleton />
  if (error || !niche) {
    return <DetailErrorState message={error ?? copy.detailNotFound} backHref={fallbackBack} copy={copy} />
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 max-w-6xl mx-auto">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 mb-6 transition-colors"
      >
        <CaretLeft weight="bold" size={14} aria-hidden />
        {copy.detailBack}
      </Link>
      <NicheDetailHeader niche={niche} copy={copy} />
      <NicheStatsPanel niche={niche} copy={copy} />
      <PerformanceChart history={history} copy={copy} tier={tierFromScore(niche.opportunityScore)} />
      <HealthCheckInline scanResultId={niche.id} userTier={tier} copy={copy} />
      <AIContentAngles scanResultId={niche.id} userTier={tier} copy={copy} />
      <ChannelVideoGrid channelId={niche.youtubeChannelId} copy={copy} />
      <RelatedNiches niche={niche} userTier={tier} copy={copy} />
    </main>
  )
}

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 max-w-6xl mx-auto" data-testid="niche-detail-skeleton">
      {/* Back link */}
      <div className="h-5 w-20 shimmer rounded mb-6" />

      {/* Header card: title + score */}
      <div className="glass rounded-2xl p-6 mb-6">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="h-3 w-24 shimmer rounded" />
            <div className="h-7 w-2/3 shimmer rounded" />
            <div className="h-4 w-1/3 shimmer rounded" />
          </div>
          <div className="shrink-0 text-right space-y-2">
            <div className="h-12 w-20 shimmer rounded ml-auto" />
            <div className="h-3 w-16 shimmer rounded ml-auto" />
          </div>
        </div>
      </div>

      {/* Stats panel: 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="glass rounded-xl p-4 space-y-2">
            <div className="h-3 w-2/3 shimmer rounded" />
            <div className="h-6 w-1/2 shimmer rounded" />
            <div className="h-3 w-3/4 shimmer rounded" />
          </div>
        ))}
      </div>

      {/* Performance chart */}
      <div className="glass rounded-2xl p-6 mb-6 space-y-4">
        <div className="h-3 w-32 shimmer rounded" />
        <div className="h-28 shimmer rounded-xl" />
        <div className="flex justify-between">
          <div className="h-3 w-12 shimmer rounded" />
          <div className="h-3 w-20 shimmer rounded" />
          <div className="h-3 w-12 shimmer rounded" />
        </div>
      </div>

      {/* Health check inline */}
      <div className="glass rounded-2xl p-6 mb-6 space-y-4">
        <div className="h-3 w-28 shimmer rounded" />
        <div className="h-5 w-1/2 shimmer rounded" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-28 h-3 shimmer rounded" />
              <div className="flex-1 h-1.5 shimmer rounded-full" />
              <div className="w-12 h-3 shimmer rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* AI angles: 5 cards in 2-col grid */}
      <div className="glass rounded-2xl p-6 mb-6">
        <div className="h-3 w-28 shimmer rounded mb-2" />
        <div className="h-5 w-2/3 shimmer rounded mb-5" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="glass rounded-xl p-4 space-y-3">
              <div className="h-3 w-16 shimmer rounded" />
              <div className="h-4 w-5/6 shimmer rounded" />
              <div className="h-3 w-3/4 shimmer rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DetailErrorState({ message, backHref, copy }: { message: string; backHref: string; copy: CopyKeys }) {
  return (
    <div className="min-h-screen px-4 py-16 flex flex-col items-center justify-center">
      <EmptyState
        illustration={<EmptyMagnifier size={88} />}
        title={message}
        cta={{ label: copy.detailBack, href: backHref }}
      />
    </div>
  )
}
