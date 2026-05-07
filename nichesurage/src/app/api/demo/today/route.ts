import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { utcDateKey } from '@/lib/tier/freeDemo'

export const runtime = 'nodejs'
// Always evaluated at request time. createServiceClient() reads runtime env
// vars; trying to prerender at build time crashes on `supabaseUrl is required`.
export const dynamic = 'force-dynamic'

// Returns the scan_result_id pinned as today's WOW demo niche.
//
// Read-only public endpoint. The detail page calls this to validate that
// a `?freeDemo=true` URL points to today's actual demo niche and not
// some hand-crafted URL — without that check, anyone could share a
// stylized welcome banner on any niche page.
//
// Cache 5 minutes at the CDN edge: the pinned row is immutable for the
// duration of a UTC day, so refreshing more often is wasted DB queries.

export async function GET(): Promise<Response> {
  const dateKey = utcDateKey(new Date())
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('daily_demo_niche')
    .select('scan_result_id')
    .eq('date', dateKey)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ scanResultId: null }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  return NextResponse.json(
    { scanResultId: data?.scan_result_id ?? null },
    {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    },
  )
}
