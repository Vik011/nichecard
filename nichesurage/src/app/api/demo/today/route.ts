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
// CDN cache 5 min — the pin is immutable for the rest of the UTC day, so
// refreshing more often is wasted load.

export async function GET(): Promise<Response> {
  try {
    const supabase = createServiceClient()
    const pin = await getDailyDemoNiche(supabase)
    return NextResponse.json(
      { scanResultId: pin?.scanResultId ?? null },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        },
      },
    )
  } catch {
    return NextResponse.json(
      { scanResultId: null },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
