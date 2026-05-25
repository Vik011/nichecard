import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkAiQuota, recordAiRun } from '@/lib/tier/aiUsage'
import { computeHealthScore } from '@/lib/health-check/score'
import { generateVerdict } from '@/lib/health-check/verdict'
import { utcDateKey } from '@/lib/tier/freeDemo'
import { preWarmDemoNiche } from '@/lib/demo/preWarm'
import type { UserTier } from '@/lib/types'

export const runtime = 'nodejs'
const CACHE_DAYS = 7

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Sprint A.9 Phase B (Task 10 hardening): free-demo-niche bypass.
  // The first-login WOW flow pins one global niche per UTC day and
  // pre-warms its Health Check cache (see lib/demo/preWarm.ts).
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
    let cached = await readHealthCache(supabase, params.id, nowIso)
    if (!cached) {
      // 2026-05-07: smoke test surfaced an infinite "Polishing the
      // verdict…" loop on the demo modal. The auth-callback fire-and-
      // forget pre-warm can fail silently (Anthropic timeout, parse
      // error, missed deploy timing) and the frontend retries forever
      // because the API just keeps saying "warming_up". On-demand
      // fallback: when the cache is genuinely empty for today's demo
      // scan_id, run preWarmDemoNiche synchronously here so the user's
      // first GET pays the ~20-30s round-trip and produces a populated
      // cache. Idempotent at the helper level — if a parallel auth
      // callback also runs it, the cache upserts converge.
      try {
        await preWarmDemoNiche(params.id)
      } catch (err) {
        console.error('[health-check] on-demand preWarm threw', err)
      }
      cached = await readHealthCache(supabase, params.id, nowIso)
    }
    if (cached) {
      return NextResponse.json({
        score: cached.health_score,
        components: cached.components,
        verdict: cached.verdict_text,
        cached: true,
        demo: true,
      })
    }
    // Even on-demand pre-warm couldn't populate the cache — Anthropic
    // is unreachable or the helper is throwing. Surface a 503 the
    // frontend can show with a retry CTA, and stop the silent retry
    // loop.
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

  // Sprint A.7: Health Check + Content Angles share a single daily AI quota
  // bundled per niche. FREE has 0 (paywall), BASIC has 1, PREMIUM unlimited.
  // checkAiQuota reads ai_usage_daily for today; we only count *successful*
  // responses (cache hit OR fresh AI run) — see recordAiRun call below.
  const quota = await checkAiQuota(supabase, user.id, tier)
  if (!quota.ok) {
    if (quota.reason === 'tier') {
      return NextResponse.json(
        { error: 'Upgrade to Basic or Premium for AI deep-dives', tier },
        { status: 403 },
      )
    }
    // reason === 'limit'
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
    .from('niche_health_checks')
    .select('health_score, components, verdict_text, expires_at')
    .eq('scan_result_id', params.id)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (cached) {
    // Strict quota semantics: cache hits still count. The user just spent
    // their daily deep-dive on this niche, regardless of whether the AI
    // had to run fresh. (See aiUsage.ts for the rationale.)
    await safeRecord(supabase, user.id)
    return NextResponse.json({
      score: cached.health_score,
      components: cached.components,
      verdict: cached.verdict_text,
      cached: true,
    })
  }

  const { data: scan, error: scanErr } = await supabase
    .from('scan_results')
    .select('id, niche_label, channel_name, language, content_type, spike_multiplier, opportunity_score, engagement_rate, virality_rating, subscriber_count, views_48h')
    .eq('id', params.id)
    .single()

  if (scanErr || !scan) {
    return NextResponse.json({ error: 'Niche not found' }, { status: 404 })
  }

  const score = computeHealthScore(scan)
  const verdict = await generateVerdict({ ...scan, score })
  const expiresAt = new Date(Date.now() + CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const serviceClient = createServiceClient()
  const { error: cacheErr } = await serviceClient.from('niche_health_checks').upsert({
    scan_result_id: scan.id,
    health_score: score.score,
    components: score.components,
    verdict_text: verdict,
    expires_at: expiresAt,
  }, { onConflict: 'scan_result_id' })
  if (cacheErr) console.error('[health-check] cache write failed:', cacheErr)

  await safeRecord(supabase, user.id)
  return NextResponse.json({
    score: score.score,
    components: score.components,
    verdict,
    cached: false,
  })
}

// Quota increment is best-effort logging — if the RPC throws (e.g. transient
// DB hiccup), we still return the AI result the user just earned. The
// alternative (fail the response after we already paid the AI cost) is
// worse for UX and we'd lose the cache write anyway. The next request will
// re-evaluate quota from whatever state the DB ends up in.
async function safeRecord(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  try {
    await recordAiRun(supabase, userId)
  } catch (err) {
    console.error('[health-check] recordAiRun failed:', (err as Error).message)
  }
}

async function readHealthCache(
  supabase: ReturnType<typeof createClient>,
  scanResultId: string,
  nowIso: string,
) {
  const { data } = await supabase
    .from('niche_health_checks')
    .select('health_score, components, verdict_text, expires_at')
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
