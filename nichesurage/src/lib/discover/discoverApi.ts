// PR-C.2 — client-side wrappers for the authenticated Discover server
// endpoints, gated behind NEXT_PUBLIC_DISCOVER_SERVER_FEED (default off).
//
// When the flag is OFF the Discover page keeps its existing direct-fetch path
// (the rollback path). When ON, it routes feed/detail reads through these
// endpoints, which redact identity server-side before serialization.

import type { NicheCardData } from '@/lib/types'
import type { DiscoverSurface } from './fetchDiscoverFeed'

/** Build-time flag; default off. Toggling requires a redeploy (NEXT_PUBLIC_). */
export function isServerFeedEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DISCOVER_SERVER_FEED === 'on'
}

export interface ServerFeedResult {
  data: NicheCardData[]
  revealedIds: string[]
  todayPinId: string | null
  error: string | null
}

export async function fetchDiscoverFeedApi(params: {
  surface: DiscoverSurface
  categories: string[]
}): Promise<ServerFeedResult> {
  const qs = new URLSearchParams()
  qs.set('surface', params.surface)
  if (params.categories.length > 0) qs.set('categories', params.categories.join(','))
  try {
    const res = await fetch(`/api/discover/feed?${qs.toString()}`, { cache: 'no-store' })
    if (!res.ok) {
      return { data: [], revealedIds: [], todayPinId: null, error: 'Discover fetch failed' }
    }
    const body = await res.json()
    return {
      data: Array.isArray(body?.data) ? (body.data as NicheCardData[]) : [],
      revealedIds: Array.isArray(body?.revealedIds) ? (body.revealedIds as string[]) : [],
      todayPinId: typeof body?.todayPinId === 'string' ? body.todayPinId : null,
      error: typeof body?.error === 'string' ? body.error : null,
    }
  } catch {
    return { data: [], revealedIds: [], todayPinId: null, error: 'Discover fetch failed' }
  }
}

export async function fetchNicheByIdApi(id: string): Promise<NicheCardData | null> {
  try {
    const res = await fetch(`/api/discover/niche/${encodeURIComponent(id)}`, { cache: 'no-store' })
    if (!res.ok) return null
    const body = await res.json()
    return (body?.data ?? null) as NicheCardData | null
  } catch {
    return null
  }
}
