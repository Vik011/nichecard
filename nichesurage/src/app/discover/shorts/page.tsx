'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SearchFilters } from '@/components/search/SearchFilters'
import { NicheCard } from '@/components/niche/NicheCard'
import { NicheCardSkeleton } from '@/components/niche/NicheCardSkeleton'
import { fetchNiches } from '@/lib/supabase/queries'
import { fetchSavedNicheIds } from '@/lib/supabase/savedNiches'
import { filtersToParams, paramsToFilters } from '@/lib/supabase/filterParams'
import { useUser } from '@/lib/context/UserContext'
import type { SearchFilters as SearchFiltersType, NicheCardData } from '@/lib/types'

const SHORTS_DEFAULTS = { subscriberMin: 1000, subscriberMax: 100000 }
const VISIBLE_STEP = 5

export default function ShortsDiscoverPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { tier: userTier, loading: userLoading } = useUser()

  const [filters, setFilters] = useState<SearchFiltersType>(() =>
    paramsToFilters(searchParams, 'shorts', SHORTS_DEFAULTS)
  )
  const [results, setResults] = useState<NicheCardData[]>([])
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
  }

  function handleFiltersChange(updated: SearchFiltersType) {
    if (updated.contentType !== 'shorts') {
      router.push(`/discover/longform?${filtersToParams(updated)}`)
      return
    }
    setFilters(updated)
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
      handleSearch(paramsToFilters(searchParams, 'shorts', SHORTS_DEFAULTS))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading])

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-block text-[10px] font-semibold tracking-[0.22em] text-glow-violet uppercase mb-2">
          Shorts Niche Discovery
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100 mb-2">
          Today&apos;s top viral Shorts opportunities
        </h1>
        <p className="text-slate-500 text-sm">
          Refreshed daily · Ranked by opportunity score
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 max-w-2xl mx-auto">
        <SearchFilters value={filters} onChange={handleFiltersChange} />
        <button
          type="button"
          onClick={() => handleSearch()}
          disabled={loading || userLoading}
          className="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          {loading ? 'Searching…' : 'Search Niches'}
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
        <div className="text-center py-12 max-w-2xl mx-auto">
          <p className="text-slate-300 text-sm font-medium mb-2">No niches found for these filters.</p>
          <p className="text-slate-500 text-xs">Try widening the subscriber range or relaxing the channel age filter.</p>
        </div>
      )}

      {!userLoading && !loading && results.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.slice(0, visibleCount).map((niche, i) => (
              <NicheCard
                key={niche.id}
                data={niche}
                userTier={userTier}
                rank={i + 1}
                isSaved={savedIds.has(niche.id)}
                savedCount={savedCount}
                onBookmarkToggle={handleBookmarkToggle}
              />
            ))}
          </div>
          {visibleCount < results.length && (
            <div className="flex justify-center mt-6">
              <button
                type="button"
                onClick={() => setVisibleCount(c => Math.min(c + VISIBLE_STEP, results.length))}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/50 text-slate-200 hover:text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                Show more ({results.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
