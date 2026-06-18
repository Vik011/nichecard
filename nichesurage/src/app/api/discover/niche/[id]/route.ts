import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchNicheById } from '@/lib/supabase/queries'
import { redactRow } from '@/lib/discover/redact'
import { resolveSessionUser, resolveTodayPinId } from '@/lib/discover/serverContext'

// PR-C.2 — authenticated Discover detail endpoint. Resolves a single niche
// server-side and redacts identity before serialization. Entitlement (B2):
//   Premium → full identity.
//   Free    → full only if id === server-resolved todayPinId; else redacted.
//   Basic   → redacted by default for context-free detail opens. Basic's
//             entitled top-5 are served full via the already-loaded FEED row
//             (the client prefers that), not via this endpoint — so a bare,
//             order-less id request fails safe rather than trusting client
//             position/tier/reveal flags.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { userId, tier } = await resolveSessionUser(supabase)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  }

  const row = await fetchNicheById(params.id, supabase)
  if (!row) {
    return NextResponse.json({ data: null, locked: false, error: null }, { status: 200, headers: NO_STORE })
  }

  let revealed: boolean
  if (tier === 'premium') {
    revealed = true
  } else if (tier === 'free') {
    const todayPinId = await resolveTodayPinId(supabase)
    revealed = row.id === todayPinId
  } else {
    // basic — fail safe for context-free detail; entitled rows come from the feed.
    revealed = false
  }

  const data = redactRow(row, revealed)
  return NextResponse.json({ data, locked: !revealed, error: null }, { status: 200, headers: NO_STORE })
}
