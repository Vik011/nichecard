'use client'

import { useCallback, useState } from 'react'
import type { UserTier } from '@/lib/types/database'
import {
  hasSeenDailyModal,
  markDailyModalSeen,
} from './dailyModalCookie'

// Returning-FREE-user daily modal trigger.
//
// Separate from useFreeDemoState (which validates the FIRST-LOGIN URL
// signal). This hook reads the daily cookie + the tier + today's pin and
// decides whether the modal should open *automatically* on /discover.
//
// Caller is responsible for fetching todayPinId from /api/demo/today.

export interface UseDailyFreeModalArgs {
  tier: UserTier
  userLoading: boolean
  todayPinId: string | null
}

export interface UseDailyFreeModalResult {
  shouldOpen: boolean
  markSeen: () => void
}

export function useDailyFreeModal(
  args: UseDailyFreeModalArgs,
): UseDailyFreeModalResult {
  const { tier, userLoading, todayPinId } = args
  // Bump on markSeen so a re-read of document.cookie happens next render.
  const [seenTick, setSeenTick] = useState(0)

  const browser = typeof window !== 'undefined'
  let shouldOpen = false
  if (browser && !userLoading && tier === 'free' && todayPinId) {
    const now = new Date()
    shouldOpen = !hasSeenDailyModal(document.cookie, now)
  }
  // seenTick is referenced to keep the value in the dep graph — without
  // this line, the closure could be eliminated by an over-eager bundler.
  void seenTick

  const markSeen = useCallback(() => {
    if (typeof window === 'undefined') return
    markDailyModalSeen(new Date())
    setSeenTick((t) => t + 1)
  }, [])

  return { shouldOpen, markSeen }
}
