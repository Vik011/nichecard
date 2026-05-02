'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SearchFilters } from '@/components/search/SearchFilters'
import { NicheCard } from '@/components/niche/NicheCard'
import { NicheCardSkeleton } from '@/components/niche/NicheCardSkeleton'
import { fetchNiches, fetchSpikeHistory } from '@/lib/supabase/queries'
import { fetchSavedNicheIds } from '@/lib/supabase/savedNiches'
import { filtersToParams, paramsToFilters, type ReadableParams } from '@/lib/supabase/filterParams'
import { useUser } from '@/lib/context/UserContext'
import { useLang } from '@/lib/i18n/useLang'
import { COPY, type CopyKeys } from '@/components/landing/copy'
import { StaggerList } from '@/components/ui/StaggerList'
import { EmptyState } from '@/components/ui/EmptyState'
import { EmptyMagnifier } from '@/components/ui/illustrations/EmptyMagnifier'
import type {
  SearchFilters as SearchFiltersType,
  NicheCardData,
  SpikePoint,
  ContentType,
} from '@/lib/types'

const DEFAULTS: Record<ContentType, { subscriberMin: number; subscriberMax: number }> = {
  shorts:   { subscriberMin: 1_000, subscriberMax: 100_000 },
  longform: { subscriberMin: 1_000, subscriberMax: 500_000 },
}

const VISIBLE_STEP = 5

function defaultFilters(contentType: ContentType): SearchFiltersType {
  return {
    contentType,
    subscriberMin: DEFAULTS[contentType].subscriberMin,
    subscriberMax: DEFAULTS[contentType].subscriberMax,
    channelAge: 'any',
    onlyRecentlyViral: false,
    sortBy: 'score',
  }
}

function resolveContentType(params: ReadableParams): ContentType {
  return params.get('type') === 'longform' ? 'longform' : 'shorts'
}

function headings(copy: CopyKeys, contentType: ContentType) {
  if (contentType === 'longform') {
    return {
      eyebrow: copy.discoverLongformEyebrow,
      headline: copy.discoverLongformHeadline,
    }
  }
  return {
    eyebrow: copy.discoverShortsEyebrow,
    headline: copy.discoverShortsHeadline,
  }
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
    <main className="min-h-screen text-slate-100 px-4 py-8 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5].map(i => <NicheCardSkeleton key={i} />)}
      </div>
    </main>
  )
}

function DiscoverPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { tier: userTier, loading: userLoading } = useUser()
  const [lang] = useLang()
  const copy = COPY[lang]

  const initialContentType = resolveContentType(searchParams)

  const [filters, setFilters] = useState<SearchFiltersType>(() =>
    paramsToFilters(searchParams, initialContentType, DEFAULTS[initialContentType])
  )
  const [results, setResults] = useState<NicheCardData[]>([])
  const [histories, setHistories] = useState<Map<string, SpikePoint[]>>(new Map())
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savedCount, setSavedCount] = useState(0)
  const [visibleCount, setVisibleCount] = useState(VISIBLE_STEP)

  async function handleSearch(filtersOverride?: SearchFiltersType) {
    const f = filtersOverride ?? filters
    setVisibleCount(VISIBLE_STEP)
    setLoading(true)
    setSearched(true)
    setError(null)
    const { data, error: fetchError } = await fetchNiches(f)
    setResults(data)
    setError(fetchError)
    setLoading(false)
    if (data.length > 0) {
      const points = await Promise.all(data.map(n => fetchSpikeHistory(n.youtubeChannelId)))
      const map = new Map<string, SpikePoint[]>()
      data.forEach((n, i) => map.set(n.id, points[i]))
      setHistories(map)
    } else {
      setHistories(new Map())
    }
  }

  function handleFiltersChange(updated: SearchFiltersType) {
    if (updated.contentType !== filters.contentType) {
      const nextDefaults = DEFAULTS[updated.contentType]
      const isCurrentDefault =
        filters.subscriberMin === DEFAULTS[filters.contentType].subscriberMin &&
        filters.subscriberMax === DEFAULTS[filters.contentType].subscriberMax
      const reconciled: SearchFiltersType = isCurrentDefault
        ? { ...updated, subscriberMin: nextDefaults.subscriberMin, subscriberMax: nextDefaults.subscriberMax }
        : updated
      const params = filtersToParams(reconciled)
      params.set('type', reconciled.contentType)
      router.replace(`/discover?${params}`)
      setFilters(reconciled)
      return
    }
    setFilters(updated)
  }

  function handleResetFilters() {
    const reset = defaultFilters(filters.contentType)
    setFilters(reset)
    handleSearch(reset)
    const params = filtersToParams(reset)
    params.set('type', reset.contentType)
    router.replace(`/discover?${params}`)
  }

  function handleBookmarkToggle(id: string, saved: boolean) {
    setSavedIds(prev => {
      const next = new Set(prev)
      if (saved) next.add(id)
      else next.delete(id)
      return next
    })
    setSavedCount(prev => saved ? prev + 1 : prev - 1)
  }

  useEffect(() => {
    if (!userLoading) {
      fetchSavedNicheIds().then(ids => {
        setSavedIds(ids)
        setSavedCount(ids.size)
      })
      const ct = resolveContentType(searchParams)
      const f = paramsToFilters(searchParams, ct, DEFAULTS[ct])
      setFilters(f)
      handleSearch(f)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading])

  const { eyebrow, headline } = headings(copy, filters.contentType)
  const fromUrl = (() => {
    const p = filtersToParams(filters)
    p.set('type', filters.contentType)
    return `/discover?${p.toString()}`
  })()

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-block text-[10px] font-semibold tracking-[0.22em] text-glow-indigo uppercase mb-2">
          {eyebrow}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100 mb-2">
          {headline}
        </h1>
        <p className="text-slate-500 text-sm">
          {copy.discoverSubline}
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 max-w-2xl mx-auto">
        <SearchFilters value={filters} onChange={handleFiltersChange} copy={copy} />
        <button
          type="button"
          onClick={() => handleSearch()}
          disabled={loading || userLoading}
          className="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          {loading ? copy.discoverSearchingBtn : copy.discoverSearchBtn}
        </button>
        {error && (
          <p className="mt-3 text-red-400 text-sm text-center">{error}</p>
        )}
      </div>

      {(userLoading || loading) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map(i => <NicheCardSkeleton key={i} />)}
        </div>
      )}

      {!userLoading && !loading && searched && results.length === 0 && !error && (
        <EmptyState
          illustration={<EmptyMagnifier size={96} />}
          title={copy.discoverEmptyTitle}
          body={copy.discoverEmptyBody}
          cta={{ label: copy.discoverResetBtn, onClick: handleResetFilters }}
        />
      )}

      {!userLoading && !loading && results.length > 0 && (
        <>
          <StaggerList
            key={`grid-${visibleCount}-${results.length}`}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {results.slice(0, visibleCount).map((niche, i) => (
              <NicheCard
                key={niche.id}
                data={niche}
                userTier={userTier}
                rank={i + 1}
                isSaved={savedIds.has(niche.id)}
                savedCount={savedCount}
                spikeHistory={histories.get(niche.id)}
                fromUrl={fromUrl}
                onBookmarkToggle={handleBookmarkToggle}
              />
            ))}
          </StaggerList>
          {visibleCount < results.length && (
            <div className="flex justify-center mt-6">
              <button
                type="button"
                onClick={() => setVisibleCount(c => Math.min(c + VISIBLE_STEP, results.length))}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/50 text-slate-200 hover:text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                {copy.discoverShowMore(results.length - visibleCount)}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
