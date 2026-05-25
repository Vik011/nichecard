import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkAiQuota, recordAiRun } from '@/lib/tier/aiUsage'
import { generateAngles, AnglesParseError } from '@/lib/content-angles/generate'
import { utcDateKey } from '@/lib/tier/freeDemo'
import { preWarmDemoNiche } from '@/lib/demo/preWarm'
import type { ContentAngle, UserTier, ContentType } from '@/lib/types'

export const runtime = 'nodejs'
const CACHE_DAYS = 7

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Sprint A.9 Phase B (Task 11 hardening): free-demo-niche bypass.
  // The first-login WOW flow pins one global niche per UTC day and
  // pre-warms its Content Angles cache (see lib/demo/preWarm.ts).
  //
  // Three signals must ALL be true to activate the bypass:
  //   1. URL has ?demo=1 (client signals intent)
  //   2. Request carries surgeniche_demo_seen cookie (set by auth callback)
  //   3. scan_id matches today's pinned daily_demo_niche row (server-authoritative)
  //
  // This prevents returning users and URL-forgers from bypassing the
  // paywall: if either client signal is missing the tier check runs instead.
  const url = new URL(req.url)
  const demoParam = url.searchParams.get('demo')
  const demoCookie = parseDemoSeenCookie(req.headers.get('cookie'))
  const wantsDemoBypass = demoParam === '1' && demoCookie
  const isDemoNiche = wantsDemoBypass && await isTodaysDemoNiche(params.id)
  if (isDemoNiche) {
    const nowIso = new Date().toISOString()
    let cached = await readAnglesCache(supabase, params.id, nowIso)
    if (!cached) {
      // On-demand fallback for the demo path — see health-check route
      // for the full rationale. The auth-callback fire-and-forget pre-
      // warm can fail silently; we run it synchronously here so the
      // user's first GET produces a populated cache instead of the
      // frontend looping on 503 forever.
      try {
        await preWarmDemoNiche(params.id)
      } catch (err) {
        console.error('[content-angles] on-demand preWarm threw', err)
      }
      cached = await readAnglesCache(supabase, params.id, nowIso)
    }
    if (cached) {
      return NextResponse.json({
        angles: cached.angles as ContentAngle[],
        cached: true,
        demo: true,
      })
    }
    return NextResponse.json(
      { error: 'warm_failed', retryAfterSeconds: 60, demo: true },
      { status: 503 },
    )
  }

  const { data: profile } = await supabase
    .from('users')
    .select('tier')
    .eq('id', user.id)
    .single()

  const tier = (profile?.tier ?? 'free') as UserTier

  // Bundled with Health Check — same daily quota counter (ai_usage_daily).
  // FREE = 403, BASIC at limit = 429 with resetAt, PREMIUM = unlimited.
  const quota = await checkAiQuota(supabase, user.id, tier)
  if (!quota.ok) {
    if (quota.reason === 'tier') {
      return NextResponse.json(
        { error: 'Upgrade to Basic or Premium for AI deep-dives', tier },
        { status: 403 },
      )
    }
    return NextResponse.json(
      {
        error: 'daily_limit',
        tier,
        usedToday: quota.usedToday,
        limit: quota.limit,
        resetAt: quota.resetAt.toISOString(),
      },
      { status: 429 },
    )
  }

  const { data: cached } = await supabase
    .from('content_angles_cache')
    .select('angles, expires_at')
    .eq('scan_result_id', params.id)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (cached) {
    await safeRecord(supabase, user.id)
    return NextResponse.json({ angles: cached.angles as ContentAngle[], cached: true })
  }

  const { data: scan, error: scanErr } = await supabase
    .from('scan_results')
    .select('id, niche_label, channel_name, language, content_type, spike_multiplier, subscriber_count, opportunity_score')
    .eq('id', params.id)
    .single()

  if (scanErr || !scan) {
    return NextResponse.json({ error: 'Niche not found' }, { status: 404 })
  }

  let angles: ContentAngle[]
  try {
    angles = await generateAngles({
      niche_label: scan.niche_label,
      channel_name: scan.channel_name,
      language: scan.language,
      content_type: scan.content_type as ContentType,
      spike_multiplier: scan.spike_multiplier,
      subscriber_count: scan.subscriber_count,
      opportunity_score: scan.opportunity_score,
    })
  } catch (err) {
    if (err instanceof AnglesParseError) {
      console.error('[content-angles] parse failed:', err.message)
      return NextResponse.json({ error: 'AI returned invalid format. Try again.' }, { status: 502 })
    }
    console.error('[content-angles] generate failed:', err)
    return NextResponse.json({ error: 'Failed to generate angles' }, { status: 502 })
  }

  const expiresAt = new Date(Date.now() + CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const serviceClient = createServiceClient()
  const { error: cacheErr } = await serviceClient.from('content_angles_cache').upsert({
    scan_result_id: scan.id,
    angles,
    expires_at: expiresAt,
  }, { onConflict: 'scan_result_id' })
  if (cacheErr) console.error('[content-angles] cache write failed:', cacheErr)

  await safeRecord(supabase, user.id)
  return NextResponse.json({ angles, cached: false })
}

async function safeRecord(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  try {
    await recordAiRun(supabase, userId)
  } catch (err) {
    console.error('[content-angles] recordAiRun failed:', (err as Error).message)
  }
}

async function readAnglesCache(
  supabase: ReturnType<typeof createClient>,
  scanResultId: string,
  nowIso: string,
) {
  const { data } = await supabase
    .from('content_angles_cache')
    .select('angles, expires_at')
    .eq('scan_result_id', scanResultId)
    .gt('expires_at', nowIso)
    .maybeSingle()
  return data
}

/**
 * Returns true when the incoming Cookie header contains the
 * `surgeniche_demo_seen` cookie set by the auth callback.
 * Uses a startsWith check on the trimmed segment to avoid false
 * positives from cookies whose names share a common prefix.
 */
function parseDemoSeenCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false
  return cookieHeader
    .split(';')
    .some((c) => c.trim().startsWith('surgeniche_demo_seen='))
}

/**
 * True when the requested scan_id matches the one pinned in
 * `daily_demo_niche` for today's UTC date. The pinned row is the only
 * niche we let free users access AI features on.
 */
async function isTodaysDemoNiche(scanResultId: string): Promise<boolean> {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('daily_demo_niche')
      .select('scan_result_id')
      .eq('date', utcDateKey(new Date()))
      .maybeSingle()
    return !!data && data.scan_result_id === scanResultId
  } catch {
    return false
  }
}
