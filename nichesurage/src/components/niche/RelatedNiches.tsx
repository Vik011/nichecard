'use client'

import { useEffect, useState } from 'react'
import type { NicheCardData, UserTier, SpikePoint } from '@/lib/types'
import type { CopyKeys } from '@/components/landing/copy'
import { fetchRelatedNiches, fetchSpikeHistory } from '@/lib/supabase/queries'
import { NicheCard } from './NicheCard'

interface RelatedNichesProps {
  niche: NicheCardData
  userTier: UserTier
  copy: CopyKeys
}

const eyebrow = 'text-[10px] font-semibold tracking-[0.22em] uppercase text-glow-violet'

export function RelatedNiches({ niche, userTier, copy }: RelatedNichesProps) {
  const [related, setRelated] = useState<NicheCardData[]>([])
  const [histories, setHistories] = useState<Map<string, SpikePoint[]>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      const list = await fetchRelatedNiches(niche, 3)
      if (cancelled) return
      setRelated(list)
      if (list.length > 0) {
        const points = await Promise.all(list.map(n => fetchSpikeHistory(n.youtubeChannelId)))
        if (cancelled) return
        const map = new Map<string, SpikePoint[]>()
        list.forEach((n, i) => map.set(n.id, points[i]))
        setHistories(map)
      }
      setLoading(false)
    }
    run()
    return () => { cancelled = true }
  }, [niche])

  if (loading) {
    return (
      <section className="mb-6">
        <div className={eyebrow + ' mb-2'}>{copy.relatedEyebrow}</div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-100 mb-5">
          {copy.relatedHeading}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass rounded-xl p-4 h-44 animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (related.length === 0) {
    return null
  }

  return (
    <section className="mb-6">
      <div className={eyebrow + ' mb-2'}>{copy.relatedEyebrow}</div>
      <h2 className="text-xl font-semibold tracking-tight text-slate-100 mb-5">
        {copy.relatedHeading}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {related.map((n, i) => (
          <NicheCard
            key={n.id}
            data={n}
            userTier={userTier}
            rank={i + 1}
            spikeHistory={histories.get(n.id)}
          />
        ))}
      </div>
    </section>
  )
}
