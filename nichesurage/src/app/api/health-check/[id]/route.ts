import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkAiQuota, recordAiRun } from '@/lib/tier/aiUsage'
import { computeHealthScore } from '@/lib/health-check/score'
import { generateVerdict } from '@/lib/health-check/verdict'
import type { UserTier } from '@/lib/types'

export const runtime = 'nodejs'
const CACHE_DAYS = 7

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
