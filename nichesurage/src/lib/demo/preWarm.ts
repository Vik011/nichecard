import { createServiceClient } from '@/lib/supabase/service'
import { computeHealthScore } from '@/lib/health-check/score'
import { generateVerdict } from '@/lib/health-check/verdict'
import { generateAngles, AnglesParseError } from '@/lib/content-angles/generate'
import type { ContentAngle, ContentType } from '@/lib/types'

// Pre-warm the AI cache for today's free-demo niche.
//
// The first-login WOW flow lands a brand-new free user in a niche-detail
// modal that we want to render with REAL premium analysis (Niche Health
// Check + AI Content Angles), not the locked teaser. Cost is bounded
// because the demo niche is global-deterministic per UTC day — one pin
// per day, ~$0.05 in Anthropic calls (one Sonnet for the verdict + one
// for angles). Even at scale, that's roughly $1.50/month.
//
// Idempotency: skips work when a non-expired cache row already exists.
// Multiple parallel callers (race between two new sign-ups inserting the
// same daily pin) all converge: the first one populates, the rest
// short-circuit.
//
// Best-effort: never throws. Caller (auth callback) calls this fire-and-
// forget; failure leaves the cache empty and the API route serves a 503
// "warming up" that the frontend retries on.

const HEALTH_TTL_DAYS = 7
const ANGLES_TTL_DAYS = 7

export interface PreWarmResult {
  /** True if the Health Check cache row is now populated (fresh or already-warm). */
  healthCheck: boolean
  /** True if the Content Angles cache row is now populated (fresh or already-warm). */
  angles: boolean
  /** Reason string when something didn't populate (for log readability). */
  notes: string[]
}

const SCAN_FIELDS =
  'id, niche_label, channel_name, language, content_type, spike_multiplier, opportunity_score, engagement_rate, virality_rating, subscriber_count, views_48h'

export async function preWarmDemoNiche(scanResultId: string): Promise<PreWarmResult> {
  const result: PreWarmResult = { healthCheck: false, angles: false, notes: [] }
  let supabase: ReturnType<typeof createServiceClient>
  try {
    supabase = createServiceClient()
  } catch (err) {
    result.notes.push(`service_client_init_failed: ${(err as Error).message}`)
    return result
  }

  const { data: scan, error: scanErr } = await supabase
    .from('scan_results')
    .select(SCAN_FIELDS)
    .eq('id', scanResultId)
    .maybeSingle()
  if (scanErr || !scan) {
    result.notes.push(`scan_not_found: ${scanErr?.message ?? 'no row'}`)
    return result
  }

  const nowIso = new Date().toISOString()

  // ── Health Check ────────────────────────────────────────────────────
  try {
    const { data: cached } = await supabase
      .from('niche_health_checks')
      .select('expires_at')
      .eq('scan_result_id', scanResultId)
      .gt('expires_at', nowIso)
      .maybeSingle()
    if (cached) {
      result.healthCheck = true
      result.notes.push('health_already_warm')
    } else {
      const score = computeHealthScore(scan)
      const verdict = await generateVerdict({ ...scan, score })
      const expiresAt = new Date(Date.now() + HEALTH_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { error: upsertErr } = await supabase
        .from('niche_health_checks')
        .upsert(
          {
            scan_result_id: scan.id,
            health_score: score.score,
            components: score.components,
            verdict_text: verdict,
            expires_at: expiresAt,
          },
          { onConflict: 'scan_result_id' },
        )
      if (upsertErr) {
        result.notes.push(`health_upsert_failed: ${upsertErr.message}`)
      } else {
        result.healthCheck = true
        result.notes.push('health_warmed')
      }
    }
  } catch (err) {
    result.notes.push(`health_threw: ${(err as Error).message}`)
  }

  // ── Content Angles ──────────────────────────────────────────────────
  try {
    const { data: cached } = await supabase
      .from('content_angles_cache')
      .select('expires_at')
      .eq('scan_result_id', scanResultId)
      .gt('expires_at', nowIso)
      .maybeSingle()
    if (cached) {
      result.angles = true
      result.notes.push('angles_already_warm')
    } else {
      const angles: ContentAngle[] = await generateAngles({
        niche_label: scan.niche_label,
        channel_name: scan.channel_name,
        language: scan.language,
        content_type: scan.content_type as ContentType,
        spike_multiplier: scan.spike_multiplier,
        subscriber_count: scan.subscriber_count,
        opportunity_score: scan.opportunity_score,
      })
      const expiresAt = new Date(Date.now() + ANGLES_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { error: upsertErr } = await supabase
        .from('content_angles_cache')
        .upsert(
          { scan_result_id: scan.id, angles, expires_at: expiresAt },
          { onConflict: 'scan_result_id' },
        )
      if (upsertErr) {
        result.notes.push(`angles_upsert_failed: ${upsertErr.message}`)
      } else {
        result.angles = true
        result.notes.push('angles_warmed')
      }
    }
  } catch (err) {
    if (err instanceof AnglesParseError) {
      result.notes.push(`angles_parse_failed: ${err.message}`)
    } else {
      result.notes.push(`angles_threw: ${(err as Error).message}`)
    }
  }

  return result
}
