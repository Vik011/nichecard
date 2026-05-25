'use client'

import { useEffect, useState } from 'react'
import { NicheDetailModal } from './NicheDetailModal'
import { NicheDetailContent } from './NicheDetailContent'
import { fetchNicheById, fetchSpikeHistory } from '@/lib/supabase/queries'
import { fetchSavedNicheIds } from '@/lib/supabase/savedNiches'
import type { CopyKeys } from '@/components/landing/copy'
import type { NicheCardData, SpikePoint } from '@/lib/types'

interface DailyFreeModalProps {
  open: boolean
  todayPinId: string
  copy: CopyKeys
  onClose: () => void
}

export function DailyFreeModal({ open, todayPinId, copy, onClose }: DailyFreeModalProps) {
  const [niche, setNiche] = useState<NicheCardData | null>(null)
  const [history, setHistory] = useState<SpikePoint[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const n = await fetchNicheById(todayPinId)
      if (cancelled || !n) {
        setLoading(false)
        return
      }
      setNiche(n)
      const [hist, saved] = await Promise.all([
        fetchSpikeHistory(n.youtubeChannelId),
        fetchSavedNicheIds(),
      ])
      if (cancelled) return
      setHistory(hist)
      setSavedIds(saved)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [open, todayPinId])

  if (!open) return null

  return (
    <NicheDetailModal
      open={open}
      onClose={onClose}
      ariaLabel={niche?.channelName ?? "Today's free niche"}
    >
      {loading || !niche ? (
        <div data-testid="daily-free-modal-skeleton" className="space-y-4">
          <div className="glass rounded-2xl p-6 space-y-3">
            <div className="h-3 w-24 shimmer rounded" />
            <div className="h-7 w-2/3 shimmer rounded" />
          </div>
        </div>
      ) : (
        <NicheDetailContent
          key={niche.id}
          niche={niche}
          history={history}
          tier="free"
          copy={copy}
          isSaved={savedIds.has(niche.id)}
          savedCount={savedIds.size}
          onBookmarkToggle={() => {}}
          onRelatedClick={() => { /* daily modal is single-niche — no related navigation */ }}
        />
      )}
    </NicheDetailModal>
  )
}
