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
      <PerformanceChart history={history} copy={copy} />
      <HealthCheckInline scanResultId={niche.id} userTier={tier} copy={copy} />
      <AIContentAngles scanResultId={niche.id} userTier={tier} copy={copy} />
      <ChannelVideoGrid channelId={niche.youtubeChannelId} copy={copy} />
      <RelatedNiches niche={niche} userTier={tier} copy={copy} />
    </main>
  )
}

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 max-w-6xl mx-auto">
      <div className="h-6 w-24 bg-charcoal-800 rounded mb-6 animate-pulse" />
      <div className="h-40 bg-charcoal-800/60 rounded-2xl mb-6 animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-charcoal-800/60 rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="h-48 bg-charcoal-800/60 rounded-2xl animate-pulse" />
    </div>
  )
}

function DetailErrorState({ message, backHref, copy }: { message: string; backHref: string; copy: CopyKeys }) {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 max-w-md mx-auto flex flex-col items-center justify-center">
      <div className="glass glass-violet rounded-2xl p-8 text-center w-full">
        <p className="text-slate-200 text-base font-semibold mb-4">{message}</p>
        <Link
          href={backHref}
          className="inline-block text-[13px] font-semibold px-4 py-2 rounded-lg gborder bg-charcoal-800/60 text-slate-200 hover:bg-charcoal-700/60 transition-colors"
        >
          {copy.detailBack}
        </Link>
      </div>
    </div>
  )
}
