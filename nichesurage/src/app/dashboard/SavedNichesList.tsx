'use client'

import { useState } from 'react'
import { NicheCard } from '@/components/niche/NicheCard'
import { StaggerList } from '@/components/ui/StaggerList'
import { EmptyState } from '@/components/ui/EmptyState'
import { EmptyMagnifier } from '@/components/ui/illustrations/EmptyMagnifier'
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
      <EmptyState
        illustration={<EmptyMagnifier size={96} />}
        title="No saved niches yet"
        body="Bookmark niches from Discover to track them here."
        cta={{ label: 'Open Discover', href: '/discover?type=shorts' }}
      />
    )
  }

  return (
    <StaggerList
      key={niches.length}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
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
    </StaggerList>
  )
}
