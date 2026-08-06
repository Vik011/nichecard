import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchDiscoverFeed, type DiscoverSurface } from '@/lib/discover/fetchDiscoverFeed'
import { redactFeed } from '@/lib/discover/redact'
import { resolveSessionUser, resolveTodayPinId } from '@/lib/discover/serverContext'

// PR-C.2 — authenticated Discover feed endpoint. Runs the existing feed logic
// server-side (injecting the session server client) and redacts channel/video
// identity for non-revealed rows BEFORE serialization. Tier is derived from the
// session and the daily pin from the DB — never trusted from client params.
//
// PR-C.2 does NOT close authenticated direct REST (a logged-in user can still
// query the tables directly with their JWT). That is PR-C.3's revoke.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
const VALID_SURFACES = new Set<DiscoverSurface>(['all', 'spiking-now', 'just-added'])

export async function GET(req: Request) {
  const supabase = createClient()

  // Fail closed: no session → 401. (The data read below trusts the session;
  // PR-C.3 will move it to service-role, where this gate is the only guard.)
  const { userId, tier } = await resolveSessionUser(supabase)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  }

  const url = new URL(req.url)
  const surfaceParam = url.searchParams.get('surface') ?? 'all'
  const surface = (VALID_SURFACES.has(surfaceParam as DiscoverSurface)
    ? surfaceParam
    : 'all') as DiscoverSurface
  const categoriesParam = url.searchParams.get('categories') ?? ''
  const categories = categoriesParam
    ? categoriesParam.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  // limit is intentionally NOT taken from the client — fetchDiscoverFeed clamps
  // it by the server-derived tier (free 60 / premium 200), so a free caller
  // cannot request the premium budget.
  const todayPinId = await resolveTodayPinId(supabase)
  const { data, error } = await fetchDiscoverFeed({ surface, categories, tier }, supabase)

  if (error) {
    return NextResponse.json(
      { data: [], revealedIds: [], todayPinId, error },
      { status: 200, headers: NO_STORE },
    )
  }

  const { data: redacted, revealedIds } = redactFeed(data, { tier, todayPinId })
  return NextResponse.json(
    { data: redacted, revealedIds, todayPinId },
    { status: 200, headers: NO_STORE },
  )
}
