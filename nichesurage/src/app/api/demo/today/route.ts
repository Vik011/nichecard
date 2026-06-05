import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getDailyDemoNiche } from '@/lib/tier/freeDemo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Returns today's globally-pinned demo niche scan_result_id.
//
// Read-mostly: getDailyDemoNiche SELECTs first; only INSERTs on the cold
// path of the day (first caller wins). All callers (anon /discover loads,
// useFreeDemoState validation, useDailyFreeModal returning-user trigger)
// see the same answer the auth callback's WOW redirect uses.
//
// CACHING: no-store for ALL responses. The pin is no longer immutable for the
// day — getDailyDemoNiche revalidates and may REPLACE today's row (PR #113),
// and it can momentarily resolve null. A shared/edge cache (the previous
// s-maxage=300) froze a null or stale pin for ~5 min per edge, which made
// different Free accounts see different reveal state at the same moment. The
// query is small and read-mostly, so correctness wins over caching here.

export async function GET(): Promise<Response> {
  try {
    const supabase = createServiceClient()
    const pin = await getDailyDemoNiche(supabase)
    return NextResponse.json(
      { scanResultId: pin?.scanResultId ?? null },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return NextResponse.json(
      { scanResultId: null },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
