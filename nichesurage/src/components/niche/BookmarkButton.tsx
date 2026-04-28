'use client'

import { useState } from 'react'
import { saveNiche, unsaveNiche } from '@/lib/supabase/savedNiches'
import { getSaveLimit } from '@/lib/tier'
import type { UserTier } from '@/lib/types'

interface BookmarkButtonProps {
  nicheId: string
  isSaved: boolean
  userTier: UserTier
  savedCount: number
  onToggle: (id: string, saved: boolean) => void
}

export function BookmarkButton({ nicheId, isSaved, userTier, savedCount, onToggle }: BookmarkButtonProps) {
  const [loading, setLoading] = useState(false)
  const [tooltip, setTooltip] = useState<string | null>(null)

  function showTooltip(msg: string) {
    setTooltip(msg)
    setTimeout(() => setTooltip(null), 2500)
  }

  async function handleClick() {
    if (userTier === 'free') {
      showTooltip('Upgrade to Basic to save niches')
      return
    }
    const limit = getSaveLimit(userTier)
    if (!isSaved && savedCount >= limit) {
      showTooltip('Save limit reached (10/10). Upgrade to Premium for unlimited saves.')
      return
    }
    setLoading(true)
    if (isSaved) {
      const { error } = await unsaveNiche(nicheId)
      if (!error) onToggle(nicheId, false)
    } else {
      const { error } = await saveNiche(nicheId)
      if (!error) onToggle(nicheId, true)
    }
    setLoading(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={isSaved ? 'Unsave niche' : 'Save niche'}
        onClick={handleClick}
        disabled={loading}
        className={`p-1.5 rounded-lg transition-colors text-lg leading-none ${
          isSaved
            ? 'text-indigo-400 hover:text-red-400 hover:bg-slate-800'
            : 'text-slate-600 hover:text-indigo-400 hover:bg-slate-800'
        } disabled:opacity-50`}
      >
        {isSaved ? '★' : '☆'}
      </button>
      {tooltip && (
        <div className="absolute right-0 top-9 z-10 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2 w-52 shadow-xl">
          {tooltip}
        </div>
      )}
    </div>
  )
}
