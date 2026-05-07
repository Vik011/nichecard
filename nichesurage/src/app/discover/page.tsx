'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { NicheCard } from '@/components/niche/NicheCard'
import { NicheCardSkeleton } from '@/components/niche/NicheCardSkeleton'
import { RevealCountdown } from '@/components/niche/RevealCountdown'
import { UpsellModal } from '@/components/niche/UpsellModal'
import { fetchSpikeHistory } from '@/lib/supabase/queries'
import { fetchSavedNicheIds } from '@/lib/supabase/savedNiches'
import {
  fetchDiscoverFeed,
  type DiscoverFeedMode,
} from '@/lib/discover/fetchDiscoverFeed'
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

function resolveMode(params: URLSearchParams): DiscoverFeedMode {
  const m = params.get('mode')
  if (m === 'all' || m === 'hot') return m
  return 'hot'
}

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

  const mode: DiscoverFeedMode = resolveMode(searchParams)

  async function handleFetch(nextMode: DiscoverFeedMode) {
    setVisibleCount(VISIBLE_STEP)
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await fetchDiscoverFeed({
      mode: nextMode,
      limit: 60,
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

  function handleModeChange(next: DiscoverFeedMode) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('mode', next)
    router.replace(`/discover?${params.toString()}`)
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
      handleFetch(mode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, mode])

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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 max-w-6xl mx-auto overflow-x-hidden">
      <div className="text-center mb-8">
        <div className="inline-block text-[10px] font-semibold tracking-[0.22em] text-glow-indigo uppercase mb-2">
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

      {/* Two-mode toggle. The whole filter UI was removed in favour of this
          single switch — mode IS the filter. Hot Now surfaces freshly
          discovered channels (last 14d), All sorts everything by outlier_ratio. */}
      <div className="flex justify-center mb-6">
        <div
          role="tablist"
          aria-label={copy.discoverModeAria}
          className="inline-flex rounded-full bg-slate-900/70 border border-slate-800 p-1"
        >
          <ModeTab
            label={copy.discoverModeHotNow}
            active={mode === 'hot'}
            onClick={() => handleModeChange('hot')}
          />
          <ModeTab
            label={copy.discoverModeAllChannels}
            active={mode === 'all'}
            onClick={() => handleModeChange('all')}
          />
        </div>
      </div>

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
            key={`grid-${mode}-${visibleCount}-${results.length}-${userTier}`}
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
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/50 text-slate-200 hover:text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
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
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/50 text-slate-200 hover:text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
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
    </main>
  )
}

interface ModeTabProps {
  label: string
  active: boolean
  onClick: () => void
}

function ModeTab({ label, active, onClick }: ModeTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        active
          ? 'rounded-full px-4 py-1.5 text-sm font-semibold bg-indigo-600 text-white'
          : 'rounded-full px-4 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-200'
      }
    >
      {label}
    </button>
  )
}
