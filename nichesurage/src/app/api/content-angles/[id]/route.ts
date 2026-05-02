import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { canUseAIFeatures } from '@/lib/tier'
import { generateAngles, AnglesParseError } from '@/lib/content-angles/generate'
import type { ContentAngle, UserTier, ContentType } from '@/lib/types'

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
    .from('content_angles_cache')
    .select('angles, expires_at')
    .eq('scan_result_id', params.id)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (cached) {
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

  return NextResponse.json({ angles, cached: false })
}
