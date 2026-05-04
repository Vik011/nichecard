/**
 * Sprint B Phase 5C — cron route that:
 *   1. detects replication clusters across all 12 categories
 *   2. labels each cluster with a narrative archetype via Claude Haiku
 *   3. flags mega-clusters (an archetype hitting ≥3 categories in 7 days)
 *
 * Schedule: every 6h (vercel.json). Roughly 12 categories × ≤20 Claude calls
 * per category = 240 Haiku calls × ~$0.0003 each = ~$0.07 / run, $0.30 / day.
 *
 * Idempotency strategy: see `_persistence.ts` — fresh (<24h) clusters per
 * category are deleted then re-inserted. Coarser than overlap-matching but
 * dramatically simpler and acceptable for v1.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { detectReplicationClusters } from '@/lib/clusters/detect'
import type { CategoryEnum } from '@/lib/types/database'
import {
  callClaudeForArchetype,
  parseArchetypeResponse,
  DEFENSIVE_DEFAULT,
  type ArchetypeMatch,
} from './_archetype'
import {
  computeAvgTrendScore,
  deleteFreshClustersForCategory,
  deleteStaleClusters,
  fetchLatestTitles,
  flagMegaClusters,
  incrementCanonicalArchetype,
  insertCluster,
  resetMegaClusterFlags,
  setClusterArchetype,
  upsertCandidateArchetype,
  type InsertedCluster,
} from './_persistence'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const CATEGORIES: CategoryEnum[] = [
  'ai_tools',
  'finance',
  'crypto',
  'tech_reviews',
  'gaming_streamers',
  'fitness_health',
  'self_improvement',
  'true_crime',
  'luxury_lifestyle',
  'celebrity_drama',
  'geopolitics_news',
  'education_howto',
]

const HOURS_WINDOW = 48
const ARCHETYPE_CALL_LIMIT_PER_CATEGORY = 20
const TITLES_PER_PROMPT = 10

function checkCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const got =
    request.headers.get('x-cron-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    null
  return got === secret
}

interface CategorySummary {
  category: CategoryEnum
  clustersDetected: number
  clustersInserted: number
  membersWritten: number
  staleDeleted: number
  archetypesMatched: number
  archetypesCreated: number
  archetypeErrors: number
}

/**
 * Run archetype matching for one cluster. Side-effects:
 *   - Increments detection_count on canonical archetypes
 *   - UPSERTs candidate archetypes
 *   - UPDATEs the cluster row with narrative_archetype_id
 *
 * Returns the chosen archetype + whether it was a brand-new candidate.
 * On any failure (Claude down, DB error) returns DEFENSIVE_DEFAULT and logs.
 */
async function labelCluster(
  supabase: ReturnType<typeof createServiceClient>,
  cluster: InsertedCluster,
  apiKey: string,
): Promise<{ matched: boolean; created: boolean; error: boolean }> {
  // Pull titles. Top N members; for now we don't have trend_score so use
  // similarity-desc which biases towards the densest part of the cluster.
  const sortedMembers = [...cluster.members].sort((a, b) => b.similarity - a.similarity)
  const topVideoIds = sortedMembers.slice(0, TITLES_PER_PROMPT).map((m) => m.videoId)
  const titlesMap = await fetchLatestTitles(supabase, topVideoIds)
  const titles = topVideoIds
    .map((id) => titlesMap.get(id))
    .filter((t): t is string => typeof t === 'string' && t.length > 0)

  if (titles.length === 0) {
    // No titles to ground the prompt — fall back to defensive default.
    try {
      await setClusterArchetype(supabase, cluster.id, DEFENSIVE_DEFAULT.archetype_id)
      return { matched: true, created: false, error: false }
    } catch (e) {
      console.error('[clusters/detect] setClusterArchetype (no-titles fallback) failed', e)
      return { matched: false, created: false, error: true }
    }
  }

  let match: ArchetypeMatch
  try {
    const raw = await callClaudeForArchetype(apiKey, titles)
    match = parseArchetypeResponse(raw)
  } catch (e) {
    console.error('[clusters/detect] Claude call failed', e)
    match = { ...DEFENSIVE_DEFAULT }
  }

  try {
    if (match.is_new) {
      await upsertCandidateArchetype(supabase, match.archetype_id, match.display_label)
      await setClusterArchetype(supabase, cluster.id, match.archetype_id)
      return { matched: true, created: true, error: false }
    }
    const ok = await incrementCanonicalArchetype(supabase, match.archetype_id)
    if (!ok) {
      // Hallucinated slug — defensive default. Telemetry increment is
      // best-effort; the user-facing pointer (setClusterArchetype) MUST
      // succeed before we claim "matched".
      try {
        await incrementCanonicalArchetype(supabase, DEFENSIVE_DEFAULT.archetype_id)
      } catch (incErr) {
        console.error('[clusters/detect] defensive increment failed (non-fatal)', incErr)
      }
      await setClusterArchetype(supabase, cluster.id, DEFENSIVE_DEFAULT.archetype_id)
      return { matched: true, created: false, error: false }
    }
    await setClusterArchetype(supabase, cluster.id, match.archetype_id)
    return { matched: true, created: false, error: false }
  } catch (e) {
    console.error('[clusters/detect] persist archetype failed', e)
    return { matched: false, created: false, error: true }
  }
}

async function processCategory(
  supabase: ReturnType<typeof createServiceClient>,
  category: CategoryEnum,
  apiKey: string | null,
): Promise<CategorySummary> {
  const summary: CategorySummary = {
    category,
    clustersDetected: 0,
    clustersInserted: 0,
    membersWritten: 0,
    staleDeleted: 0,
    archetypesMatched: 0,
    archetypesCreated: 0,
    archetypeErrors: 0,
  }

  const candidates = await detectReplicationClusters(supabase, category, HOURS_WINDOW)
  summary.clustersDetected = candidates.length

  // Wipe fresh-window clusters so we can re-insert idempotently.
  await deleteFreshClustersForCategory(supabase, category)

  const inserted: InsertedCluster[] = []
  for (const c of candidates) {
    const memberIds = c.members.map((m) => m.videoId)
    const avg = await computeAvgTrendScore(supabase, memberIds)
    try {
      const row = await insertCluster(supabase, category, c, avg)
      inserted.push(row)
      summary.clustersInserted++
      summary.membersWritten += row.members.length
    } catch (e) {
      console.error('[clusters/detect] insertCluster failed', { category, centroid: c.centroidVideoId }, e)
    }
  }

  // Archetype labelling — top N by member count.
  if (apiKey && inserted.length > 0) {
    const sorted = [...inserted].sort((a, b) => b.members.length - a.members.length)
    const toLabel = sorted.slice(0, ARCHETYPE_CALL_LIMIT_PER_CATEGORY)
    for (const cluster of toLabel) {
      const r = await labelCluster(supabase, cluster, apiKey)
      if (r.matched) summary.archetypesMatched++
      if (r.created) summary.archetypesCreated++
      if (r.error) summary.archetypeErrors++
    }
  }

  summary.staleDeleted = await deleteStaleClusters(supabase, category)

  return summary
}

export async function GET(request: Request) {
  if (!checkCronSecret(request)) {
    return new Response('unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()
  const apiKey = process.env.ANTHROPIC_API_KEY ?? null
  if (!apiKey) {
    console.warn('[clusters/detect] ANTHROPIC_API_KEY not set — skipping archetype matching')
  }

  // Reset mega-cluster flags up-front so we re-derive them after this run.
  try {
    await resetMegaClusterFlags(supabase)
  } catch (e) {
    console.error('[clusters/detect] resetMegaClusterFlags failed', e)
  }

  const summaries: CategorySummary[] = []
  for (const category of CATEGORIES) {
    try {
      const s = await processCategory(supabase, category, apiKey)
      summaries.push(s)
      console.log('[clusters/detect] category done', JSON.stringify(s))
    } catch (e) {
      console.error('[clusters/detect] category failed', category, e)
      summaries.push({
        category,
        clustersDetected: 0,
        clustersInserted: 0,
        membersWritten: 0,
        staleDeleted: 0,
        archetypesMatched: 0,
        archetypesCreated: 0,
        archetypeErrors: 1,
      })
    }
  }

  let megaFlagged = 0
  try {
    megaFlagged = await flagMegaClusters(supabase)
  } catch (e) {
    console.error('[clusters/detect] flagMegaClusters failed', e)
  }

  return Response.json({
    ok: true,
    categories: summaries,
    megaClusterRowsFlagged: megaFlagged,
  })
}
