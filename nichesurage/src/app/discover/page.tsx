'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { NicheCard } from '@/components/niche/NicheCard'
import { NicheCardSkeleton } from '@/components/niche/NicheCardSkeleton'
import { RevealCountdown } from '@/components/niche/RevealCountdown'
import { UpsellModal } from '@/components/niche/UpsellModal'
import { NicheDetailModal } from '@/components/niche/NicheDetailModal'
import { NicheDetailContent } from '@/components/niche/NicheDetailContent'
import { fetchNicheById, fetchSpikeHistory } from '@/lib/supabase/queries'
import { fetchSavedNicheIds } from '@/lib/supabase/savedNiches'
import { fetchDiscoverFeed } from '@/lib/discover/fetchDiscoverFeed'
import { useUser } from '@/lib/context/UserContext'
import { useLang } from '@/lib/i18n/useLang'
import { COPY } from '@/components/landing/copy'
import { StaggerList } from '@/components/ui/StaggerList'
import { SonarEmptyState } from '@/components/ui/SonarEmptyState'
import { getRevealedIds } from '@/lib/tier/reveal'
import { computeVisibleResults } from '@/lib/tier/visibleResults'
import type { NicheCardData, SpikePoint } from '@/lib/types'

// Pagination step. Initial render shows the first STEP cards; each
// "Show more" reveals another STEP. Backed by a 60-row server fetch in
// fetchDiscoverFeed (DEFAULT_LIMIT). Show-more capped at fetched count.
const VISIBLE_STEP = 12

export default function DiscoverPage() {
  return (
    <Suspense fallback={<DiscoverFallback />}>
      <DiscoverPageInner />
    </Suspense>
  )
}

function DiscoverFallback() {
  return (
    <main className="min-h-screen text-slate-100 px-4 py-8 max-w-6xl mx-auto overflow-x-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => <NicheCardSkeleton key={i} />)}
      </div>
    </main>
  )
}

function DiscoverPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { tier: userTier, userId, loading: userLoading } = useUser()
  const [lang] = useLang()
  const copy = COPY[lang]

  const [results, setResults] = useState<NicheCardData[]>([])
  const [histories, setHistories] = useState<Map<string, SpikePoint[]>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savedCount, setSavedCount] = useState(0)
  const [visibleCount, setVisibleCount] = useState(VISIBLE_STEP)
  const [upsellOpen, setUpsellOpen] = useState(false)

  // 2026-05-07 trend-engine deprecation: removed the Hot/All toggle.
  // Sprint B's video-level trending was never bootstrapped in production;
  // the toggle made the page feel "in progress" without delivering value.
  // Discover now ships with one mode — channels added recently, sorted
  // by outlier_ratio — which `fetchDiscoverFeed('hot')` already produces.
  async function handleFetch() {
    setVisibleCount(VISIBLE_STEP)
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await fetchDiscoverFeed({
      mode: 'hot',
      tier: userTier,
    })
    setResults(data)
    setError(fetchError)
    setLoading(false)
    if (data.length > 0) {
      const points = await Promise.all(
        data.map((n) => fetchSpikeHistory(n.youtubeChannelId)),
      )
      const histMap = new Map<string, SpikePoint[]>()
      data.forEach((n, i) => histMap.set(n.id, points[i]))
      setHistories(histMap)
    } else {
      setHistories(new Map())
    }
  }

  function handleBookmarkToggle(id: string, saved: boolean) {
    setSavedIds((prev) => {
      const next = new Set(prev)
      if (saved) next.add(id)
      else next.delete(id)
      return next
    })
    setSavedCount((prev) => (saved ? prev + 1 : prev - 1))
  }

  useEffect(() => {
    if (!userLoading) {
      fetchSavedNicheIds().then((ids) => {
        setSavedIds(ids)
        setSavedCount(ids.size)
      })
      handleFetch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, userTier])

  // Reveal set for free tier is recomputed when results change.
  const revealedIds = useMemo(() => {
    const ids = results.map((n) => n.id)
    return getRevealedIds(userTier, ids, userId ?? '', new Date())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, userTier, userId])

  // Fix B (memo `2026-05-05-launch-debug.md` Issue #3): for free tier, the
  // visible grid must always include the rotating reveal at position 5,
  // even when its underlying rank is 4-14. Logic lives in a pure helper
  // so it can be unit-tested independent of the React render path.
  const visibleResults = useMemo(() => {
    return computeVisibleResults({
      tier: userTier,
      userId: userId ?? '',
      results,
      visibleCount,
      now: new Date(),
    })
  }, [results, userTier, userId, visibleCount])

  const showShowMore = userTier !== 'free' && visibleCount < results.length

  // Niche-detail modal state — driven by ?niche=<id> on the URL so opening
  // a card creates a back-button-able history entry, refreshes preserve
  // the open card, and links can be shared. Closing simply drops the
  // param from the URL; we keep the rest of the params (mode, type,
  // freeDemo) so closing the modal lands the user in the same filter
  // context they came from.
  const nicheParam = searchParams.get('niche')
  const [modalNiche, setModalNiche] = useState<NicheCardData | null>(null)
  const [modalHistory, setModalHistory] = useState<SpikePoint[]>([])
  const [modalLoading, setModalLoading] = useState(false)

  useEffect(() => {
    if (!nicheParam) {
      setModalNiche(null)
      setModalHistory([])
      return
    }
    let cancelled = false
    setModalLoading(true)
    ;(async () => {
      const n = await fetchNicheById(nicheParam)
      if (cancelled) return
      if (!n) {
        setModalLoading(false)
        return
      }
      setModalNiche(n)
      const h = await fetchSpikeHistory(n.youtubeChannelId)
      if (cancelled) return
      setModalHistory(h)
      setModalLoading(false)
    })()
    return () => { cancelled = true }
  }, [nicheParam])

  const openNicheModal = useCallback((id: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('niche', id)
    router.push(`/discover?${params.toString()}`)
  }, [router, searchParams])

  const closeNicheModal = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('niche')
    // freeDemo is one-shot UI signal that pairs with the niche param. If
    // the user dismisses the demo modal we drop both so a stray refresh
    // doesn't reopen the welcome flourish on a niche that's no longer
    // today's demo.
    params.delete('freeDemo')
    const qs = params.toString()
    router.replace(qs ? `/discover?${qs}` : '/discover')
  }, [router, searchParams])

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 max-w-6xl mx-auto overflow-x-hidden">
      <div className="text-center mb-8">
        <div className="inline-block text-[10px] font-semibold tracking-[0.22em] text-emerald-300 uppercase mb-2">
          {copy.discoverEyebrow}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100 mb-2">
          {copy.discoverHeadline}
        </h1>
        <p className="text-slate-500 text-sm">
          {copy.discoverSubline}
        </p>
      </div>

      {!userLoading && (
        <div className="flex justify-center mb-5">
          <RevealCountdown tier={userTier} copy={copy} />
        </div>
      )}

      {error && (
        <p className="text-center text-red-400 text-sm mb-4">{error}</p>
      )}

      {(userLoading || loading) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <NicheCardSkeleton key={i} />)}
        </div>
      )}

      {!userLoading && !loading && results.length === 0 && !error && (
        <SonarEmptyState
          caption={copy.discoverScanningDeepWeb}
          hint={copy.discoverEmptyBody}
        />
      )}

      {!userLoading && !loading && results.length > 0 && (
        <>
          <StaggerList
            key={`grid-${visibleCount}-${results.length}-${userTier}`}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {visibleResults.map((niche, i) => (
              <NicheCard
                key={niche.id}
                data={niche}
                userTier={userTier}
                rank={i + 1}
                revealed={revealedIds.has(niche.id)}
                onLockedClick={() => setUpsellOpen(true)}
                onUnlockedClick={openNicheModal}
                isSaved={savedIds.has(niche.id)}
                savedCount={savedCount}
                spikeHistory={histories.get(niche.id)}
                fromUrl="/discover"
                onBookmarkToggle={handleBookmarkToggle}
              />
            ))}
          </StaggerList>
          {showShowMore && (
            <div className="flex justify-center mt-6">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => Math.min(c + VISIBLE_STEP, results.length))}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/30 text-slate-200 hover:text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                {copy.discoverShowMore(results.length - visibleCount)}
              </button>
            </div>
          )}
          {userTier === 'free' && results.length > visibleResults.length && (
            <div className="flex flex-col items-center mt-6 gap-2">
              <button
                type="button"
                onClick={() => setUpsellOpen(true)}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/30 text-slate-200 hover:text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                {copy.discoverShowMoreFreeUpsell(results.length - visibleResults.length)}
              </button>
            </div>
          )}
        </>
      )}

      {upsellOpen && (
        <UpsellModal tier={userTier} copy={copy} onClose={() => setUpsellOpen(false)} />
      )}

      <NicheDetailModal
        open={!!nicheParam}
        onClose={closeNicheModal}
        ariaLabel={modalNiche?.channelName ?? 'Niche detail'}
      >
        {modalLoading || !modalNiche ? (
          <NicheDetailModalSkeleton />
        ) : (
          <NicheDetailContent
            niche={modalNiche}
            history={modalHistory}
            tier={userTier}
            copy={copy}
            isSaved={savedIds.has(modalNiche.id)}
            savedCount={savedCount}
            onBookmarkToggle={handleBookmarkToggle}
          />
        )}
      </NicheDetailModal>
    </main>
  )
}

function NicheDetailModalSkeleton() {
  return (
    <div data-testid="niche-detail-modal-skeleton" className="space-y-4">
      <div className="glass rounded-2xl p-6 space-y-3">
        <div className="h-3 w-24 shimmer rounded" />
        <div className="h-7 w-2/3 shimmer rounded" />
        <div className="h-4 w-1/3 shimmer rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="glass rounded-xl p-4 space-y-2">
            <div className="h-3 w-2/3 shimmer rounded" />
            <div className="h-6 w-1/2 shimmer rounded" />
          </div>
        ))}
      </div>
      <div className="glass rounded-2xl p-6">
        <div className="h-28 shimmer rounded-xl" />
      </div>
    </div>
  )
}

