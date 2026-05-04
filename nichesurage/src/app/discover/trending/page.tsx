'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { fetchClusterFeed } from '@/lib/discover/fetchClusterFeed'
import { TrendingClusterCard } from '@/components/discover/TrendingClusterCard'
import { SonarEmptyState } from '@/components/ui/SonarEmptyState'
import { COPY } from '@/components/landing/copy'
import { useLang } from '@/lib/i18n/useLang'
import type { TrendClusterCard as Card } from '@/lib/types/trend'

// Sprint B Phase 7B — cluster trending route. Cluster-first entry point
// to /discover. Mega clusters render in their own "Cross-niche waves"
// section above the main grid (per amendment Step 7.11).

// 12 industry categories from category_enum (see migration 0024). Mirrored
// here because category_enum lives in DB only and we want a stable client-
// side filter without a round-trip.
const CATEGORIES: { slug: string; label: string }[] = [
  { slug: 'ai_tools',         label: 'AI tools' },
  { slug: 'finance',          label: 'Finance' },
  { slug: 'crypto',           label: 'Crypto' },
  { slug: 'tech_reviews',     label: 'Tech reviews' },
  { slug: 'gaming_streamers', label: 'Gaming' },
  { slug: 'fitness_health',   label: 'Fitness & health' },
  { slug: 'self_improvement', label: 'Self-improvement' },
  { slug: 'true_crime',       label: 'True crime' },
  { slug: 'luxury_lifestyle', label: 'Luxury lifestyle' },
  { slug: 'celebrity_drama',  label: 'Celebrity drama' },
  { slug: 'geopolitics_news', label: 'Geopolitics & news' },
  { slug: 'education_howto',  label: 'Education / how-to' },
]

export default function DiscoverTrendingPage() {
  return (
    <Suspense fallback={<TrendingFallback />}>
      <DiscoverTrendingInner />
    </Suspense>
  )
}

function TrendingFallback() {
  return (
    <main className="min-h-screen text-slate-100 px-4 py-8 max-w-6xl mx-auto overflow-x-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-44 rounded-xl border border-slate-800 bg-slate-900 animate-pulse" />
        ))}
      </div>
    </main>
  )
}

function DiscoverTrendingInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [lang] = useLang()
  const copy = COPY[lang]

  const activeCategory = searchParams.get('category') ?? undefined

  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchClusterFeed({ category: activeCategory })
      .then(rows => {
        if (!cancelled) {
          setCards(rows)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCards([])
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [activeCategory])

  const { mega, regular } = useMemo(() => {
    const mega: Card[] = []
    const regular: Card[] = []
    for (const c of cards) (c.isMegaCluster ? mega : regular).push(c)
    return { mega, regular }
  }, [cards])

  function handleCategoryClick(slug?: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (slug) params.set('category', slug)
    else params.delete('category')
    const qs = params.toString()
    router.replace(qs ? `/discover/trending?${qs}` : '/discover/trending')
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 max-w-6xl mx-auto overflow-x-hidden">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-block text-[10px] font-semibold tracking-[0.22em] text-glow-indigo uppercase mb-2">
          {copy.discoverTrendingEyebrow}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100 mb-2">
          {copy.discoverTrendingHeadline}
        </h1>
        <p className="text-slate-500 text-sm">
          {copy.discoverTrendingSubline}
        </p>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-1.5 justify-center mb-6">
        <button
          type="button"
          onClick={() => handleCategoryClick(undefined)}
          aria-pressed={!activeCategory}
          className={
            !activeCategory
              ? 'rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white'
              : 'rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-400 hover:text-slate-200'
          }
        >
          {copy.discoverTrendingAllCategories}
        </button>
        {CATEGORIES.map(c => {
          const active = activeCategory === c.slug
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => handleCategoryClick(c.slug)}
              aria-pressed={active}
              className={
                active
                  ? 'rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white'
                  : 'rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-400 hover:text-slate-200'
              }
            >
              {c.label}
            </button>
          )
        })}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-44 rounded-xl border border-slate-800 bg-slate-900 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && cards.length === 0 && (
        <SonarEmptyState
          caption={copy.discoverScanningDeepWeb}
          hint={copy.discoverTrendingNoClusters}
        />
      )}

      {/* Cross-niche waves section */}
      {!loading && mega.length > 0 && (
        <section className="mb-8">
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 mb-4">
            <h2 className="text-rose-200 font-semibold text-sm">
              {copy.discoverTrendingCrossNicheTitle}
            </h2>
            <p className="text-rose-200/70 text-xs mt-0.5">
              {copy.discoverTrendingCrossNicheSubline}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mega.map(card => (
              <TrendingClusterCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      )}

      {/* Main cluster grid */}
      {!loading && regular.length > 0 && (
        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regular.map(card => (
              <TrendingClusterCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
