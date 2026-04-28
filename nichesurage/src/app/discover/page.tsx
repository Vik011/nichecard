'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SearchFilters } from '@/components/search/SearchFilters'
import { NicheCard } from '@/components/niche/NicheCard'
import { NicheCardSkeleton } from '@/components/niche/NicheCardSkeleton'
import { fetchNiches } from '@/lib/supabase/queries'
import { fetchSavedNicheIds } from '@/lib/supabase/savedNiches'
import { filtersToParams, paramsToFilters, type ReadableParams } from '@/lib/supabase/filterParams'
import { useUser } from '@/lib/context/UserContext'
import type { SearchFilters as SearchFiltersType, NicheCardData, ContentType } from '@/lib/types'

const DEFAULTS: Record<ContentType, { subscriberMin: number; subscriberMax: number }> = {
  shorts: { subscriberMin: 1000, subscriberMax: 100000 },
  longform: { subscriberMin: 1000, subscriberMax: 500000 },
}

const HEADINGS: Record<ContentType, { icon: string; title: string; sub: string }> = {
  shorts: {
    icon: '🎬',
    title: 'Shorts Niche Discovery',
    sub: 'Find viral Shorts niches. Set your filters and search.',
  },
  longform: {
    icon: '🎥',
    title: 'Longform Niche Discovery',
    sub: 'Find high-potential Longform niches. Set your filters and search.',
  },
}

function resolveContentType(params: ReadableParams): ContentType {
  return params.get('type') === 'longform' ? 'longform' : 'shorts'
}

export default function DiscoverPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { tier: userTier, loading: userLoading } = useUser()

  const contentType = resolveContentType(searchParams)

  const [filters, setFilters] = useState<SearchFiltersType>(() =>
    paramsToFilters(searchParams, contentType, DEFAULTS[contentType])
  )
  const [results, setResults] = useState<NicheCardData[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savedCount, setSavedCount] = useState(0)

  async function handleSearch(filtersOverride?: SearchFiltersType) {
    const f = filtersOverride ?? filters
    setLoading(true)
    setSearched(true)
    setError(null)
    const { data, error: fetchError } = await fetchNiches(f)
    setResults(data)
    setError(fetchError)
    setLoading(false)
  }

  function handleFiltersChange(updated: SearchFiltersType) {
    const params = filtersToParams(updated)
    params.set('type', updated.contentType)
    router.replace(`/discover?${params}`)
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
      if (searchParams.size > 0) {
        const ct = resolveContentType(searchParams)
        const f = paramsToFilters(searchParams, ct, DEFAULTS[ct])
        setFilters(f)
        handleSearch(f)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading])

  const { icon, title, sub } = HEADINGS[contentType]

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">
        {icon} {title}
      </h1>
      <p className="text-slate-400 text-sm mb-6">{sub}</p>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
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
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <NicheCardSkeleton key={i} />)}
        </div>
      )}

      {!userLoading && !loading && searched && results.length === 0 && !error && (
        <p className="text-slate-500 text-center py-12">No niches found for these filters.</p>
      )}

      {!userLoading && !loading && results.length > 0 && (
        <div className="flex flex-col gap-3">
          {results.map((niche, i) => (
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
      )}
    </main>
  )
}
