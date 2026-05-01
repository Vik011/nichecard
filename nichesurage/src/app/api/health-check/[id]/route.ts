import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { canUseAIFeatures } from '@/lib/tier'
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
  if (!canUseAIFeatures(tier)) {
    return NextResponse.json({ error: 'Premium required' }, { status: 403 })
  }

  const { data: cached } = await supabase
    .from('niche_health_checks')
    .select('health_score, components, verdict_text, expires_at')
    .eq('scan_result_id', params.id)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (cached) {
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

  return NextResponse.json({
    score: score.score,
    components: score.components,
    verdict,
    cached: false,
  })
}
