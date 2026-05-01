'use client'

import { useState } from 'react'
import { NicheCard } from '@/components/niche/NicheCard'
import { unsaveNiche } from '@/lib/supabase/savedNiches'
import type { NicheCardData, UserTier } from '@/lib/types'

interface SavedNichesListProps {
  initialNiches: NicheCardData[]
  userTier: UserTier
}

export function SavedNichesList({ initialNiches, userTier }: SavedNichesListProps) {
  const [niches, setNiches] = useState(initialNiches)

  function handleBookmarkToggle(id: string, saved: boolean) {
    if (!saved) {
      setNiches(prev => prev.filter(n => n.id !== id))
    }
  }

  if (niches.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400 text-lg mb-2">No saved niches yet.</p>
        <p className="text-slate-600 text-sm">
          Go to{' '}
          <a href="/discover/shorts" className="text-indigo-400 hover:text-indigo-300 underline">
            Discover
          </a>{' '}
          and star niches you want to track.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {niches.map((niche, i) => (
        <NicheCard
          key={niche.id}
          data={niche}
          userTier={userTier}
          rank={i + 1}
          isSaved={true}
          savedCount={niches.length}
          onBookmarkToggle={handleBookmarkToggle}
        />
      ))}
    </div>
  )
}
