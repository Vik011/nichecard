'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { fetchTrendingClusters } from '@/lib/supabase/queries'
import type { TrendingCluster } from '@/lib/types'

interface TrendingTopicsProps {
  eyebrow: string
  emptyHint?: string
  activeClusterId?: string | null
  basePath?: string
}

export function TrendingTopics({ eyebrow, emptyHint, activeClusterId, basePath = '/discover' }: TrendingTopicsProps) {
  const [clusters, setClusters] = useState<TrendingCluster[] | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    let cancelled = false
    fetchTrendingClusters(8).then(rows => {
      if (!cancelled) setClusters(rows)
    })
    return () => { cancelled = true }
  }, [])

  // Preserve current searchParams (e.g. ?type=longform) when applying the cluster
  // filter. Otherwise navigating to ?cluster=X drops the format toggle and the
  // page falls back to shorts default — so longform clusters render empty.
  function buildClusterHref(clusterId: string): string {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('cluster', clusterId)
    return `${basePath}?${params.toString()}`
  }

  if (clusters !== null && clusters.length === 0) {
    if (!emptyHint) return null
    return (
      <div className="mb-5 text-slate-500 text-xs italic">
        {emptyHint}
      </div>
    )
  }

  return (
    <div className="mb-5">
      <div className="text-[10px] font-semibold tracking-[0.22em] uppercase text-glow-indigo mb-2">
        {eyebrow}
      </div>
      <div
        role="list"
        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin"
      >
        {clusters === null
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                aria-hidden
                className="shimmer h-7 w-32 shrink-0 rounded-full bg-charcoal-800/60"
              />
            ))
          : clusters.map(c => {
              const isActive = activeClusterId === c.id
              return (
                <Link
                  key={c.id}
                  role="listitem"
                  href={buildClusterHref(c.id)}
                  className={`group glass rounded-full px-3.5 py-1.5 text-xs whitespace-nowrap transition-all shrink-0 ${
                    isActive
                      ? 'ring-1 ring-glow-indigo text-slate-100 bg-charcoal-700/60'
                      : 'hover:ring-1 hover:ring-glow-indigo/40 text-slate-300'
                  }`}
                >
                  <span className="font-medium">{c.label}</span>
                  <span className="text-slate-500 ml-2">{c.memberCount}</span>
                </Link>
              )
            })}
      </div>
    </div>
  )
}
