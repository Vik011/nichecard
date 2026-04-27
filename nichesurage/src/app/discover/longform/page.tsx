'use client'

import { useState } from 'react'
import { SearchFilters } from '@/components/search/SearchFilters'
import { NicheCard } from '@/components/niche/NicheCard'
import { NicheCardSkeleton } from '@/components/niche/NicheCardSkeleton'
import type { SearchFilters as SearchFiltersType, LongformNicheCardData } from '@/lib/types'

const DEFAULT_FILTERS: SearchFiltersType = {
  contentType: 'longform',
  subscriberMin: 1000,
  subscriberMax: 500000,
  channelAge: 'any',
  onlyRecentlyViral: false,
}

// Placeholder cards shown until real data fetching is wired up
const MOCK_RESULTS: LongformNicheCardData[] = [
  {
    id: 'mock-1',
    contentType: 'longform',
    channelCreatedAt: '2023-06-01',
    videoCount: 34,
    subscriberRange: '10K–50K',
    spikeMultiplier: 3.1,
    opportunityScore: 74,
    viralityRating: 'good',
    language: 'en',
    channelName: 'Example Longform Channel',
    nicheLabel: 'Personal Finance',
    channelUrl: 'https://youtube.com',
    engagementRate: 6.1,
    searchVolume: 62000,
    competitionScore: 28,
    avgViewsPerVideo: 18500,
  },
]

export default function LongformDiscoverPage() {
  const [filters, setFilters] = useState<SearchFiltersType>(DEFAULT_FILTERS)
  const [results, setResults] = useState<LongformNicheCardData[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  function handleSearch() {
    setLoading(true)
    setSearched(true)
    // TODO: replace with real Supabase fetch using filters
    setTimeout(() => {
      setResults(MOCK_RESULTS)
      setLoading(false)
    }, 800)
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">
        🎥 Longform Niche Discovery
      </h1>
      <p className="text-slate-400 text-sm mb-6">
        Find high-potential Longform niches. Set your filters and search.
      </p>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <SearchFilters value={filters} onChange={setFilters} />
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          {loading ? 'Searching…' : 'Search Niches'}
        </button>
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <NicheCardSkeleton key={i} />)}
        </div>
      )}

      {!loading && searched && results.length === 0 && (
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
