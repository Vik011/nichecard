'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SearchFilters } from '@/components/search/SearchFilters'
import { NicheCard } from '@/components/niche/NicheCard'
import { NicheCardSkeleton } from '@/components/niche/NicheCardSkeleton'
import { fetchNiches } from '@/lib/supabase/queries'
import { filtersToParams, paramsToFilters } from '@/lib/supabase/filterParams'
import type { SearchFilters as SearchFiltersType, NicheCardData } from '@/lib/types'

const LONGFORM_DEFAULTS = { subscriberMin: 1000, subscriberMax: 500000 }

export default function LongformDiscoverPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [filters, setFilters] = useState<SearchFiltersType>(() =>
    paramsToFilters(searchParams, 'longform', LONGFORM_DEFAULTS)
  )
  const [results, setResults] = useState<NicheCardData[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    if (updated.contentType !== 'longform') {
      router.push(`/discover/shorts?${filtersToParams(updated)}`)
      return
    }
    setFilters(updated)
  }

  useEffect(() => {
    if (searchParams.size > 0) {
      handleSearch(paramsToFilters(searchParams, 'longform', LONGFORM_DEFAULTS))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">
        🎥 Longform Niche Discovery
      </h1>
      <p className="text-slate-400 text-sm mb-6">
        Find high-potential Longform niches. Set your filters and search.
      </p>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <SearchFilters value={filters} onChange={handleFiltersChange} />
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          {loading ? 'Searching…' : 'Search Niches'}
        </button>
        {error && (
          <p className="mt-3 text-red-400 text-sm text-center">{error}</p>
        )}
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <NicheCardSkeleton key={i} />)}
        </div>
      )}

      {!loading && searched && results.length === 0 && !error && (
        <p className="text-slate-500 text-center py-12">No niches found for these filters.</p>
      )}

      {!loading && results.length > 0 && (
        <div className="flex flex-col gap-3">
          {results.map((niche, i) => (
            <NicheCard key={niche.id} data={niche} userTier="basic" rank={i + 1} />
          ))}
        </div>
      )}
    </main>
  )
}
