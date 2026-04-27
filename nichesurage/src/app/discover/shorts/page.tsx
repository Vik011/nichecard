'use client'

import { useState } from 'react'
import { SearchFilters } from '@/components/search/SearchFilters'
import { NicheCard } from '@/components/niche/NicheCard'
import { NicheCardSkeleton } from '@/components/niche/NicheCardSkeleton'
import type { SearchFilters as SearchFiltersType, ShortsNicheCardData } from '@/lib/types'

const DEFAULT_FILTERS: SearchFiltersType = {
  contentType: 'shorts',
  subscriberMin: 1000,
  subscriberMax: 100000,
  channelAge: 'any',
  onlyRecentlyViral: false,
}

// Placeholder cards shown until real data fetching is wired up
const MOCK_RESULTS: ShortsNicheCardData[] = [
  {
    id: 'mock-1',
    contentType: 'shorts',
    channelCreatedAt: '2024-03-01',
    videoCount: 62,
    subscriberRange: '5K–10K',
    spikeMultiplier: 7.4,
    opportunityScore: 88,
    viralityRating: 'excellent',
    language: 'en',
    channelName: 'Example Shorts Channel',
    nicheLabel: 'Finance Shorts',
    channelUrl: 'https://youtube.com',
    engagementRate: 5.3,
    avgViewDurationPct: 71,
    hookScore: 92,
  },
]

export default function ShortsDiscoverPage() {
  const [filters, setFilters] = useState<SearchFiltersType>(DEFAULT_FILTERS)
  const [results, setResults] = useState<ShortsNicheCardData[]>([])
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
        🎬 Shorts Niche Discovery
      </h1>
      <p className="text-slate-400 text-sm mb-6">
        Find viral Shorts niches. Set your filters and search.
      </p>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        {/* TODO: contentType toggle — when real fetch is wired, either hide this toggle or navigate to /discover/longform on switch */}
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
            // TODO: replace "basic" with real user tier from session/context
            <NicheCard key={niche.id} data={niche} userTier="basic" rank={i + 1} />
          ))}
        </div>
      )}
    </main>
  )
}
