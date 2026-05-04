/**
 * Sprint B Phase 5C — DB persistence helpers for cluster detection.
 *
 * Idempotency strategy: simpler fallback per spec.
 *   - At the start of each category run, DELETE all `trend_clusters` for the
 *     category whose `last_updated_at > now() - 24h` (treats them as
 *     "still-fresh" rows we own and can safely overwrite). Members cascade.
 *   - Then INSERT freshly-detected clusters.
 *   - This loses cluster IDs across runs but is dramatically simpler than
 *     overlap-matching. v1 acceptable.
 *
 * Stale cleanup: at end of each category run, DELETE clusters where
 * last_updated_at < now() - 7d. Members cascade.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CategoryEnum } from '@/lib/types/database'
import type { ClusterCandidate } from '@/lib/clusters/detect'

const FRESH_WINDOW_HOURS = 24
const STALE_AGE_DAYS = 7

export interface InsertedCluster {
  id: number
  centroidVideoId: string
  members: { videoId: string; similarity: number }[]
}

/**
 * Delete fresh (<24h) clusters for the category so we can re-insert them
 * idempotently. Returns count of deleted rows.
 */
export async function deleteFreshClustersForCategory(
  supabase: SupabaseClient,
  category: CategoryEnum,
): Promise<number> {
  const cutoff = new Date(Date.now() - FRESH_WINDOW_HOURS * 3600 * 1000).toISOString()
  const { error, count } = await supabase
    .from('trend_clusters')
    .delete({ count: 'exact' })
    .eq('category', category)
    .gt('last_updated_at', cutoff)
  if (error) throw new Error(`deleteFreshClustersForCategory: ${error.message}`)
  return count ?? 0
}

/**
 * Stale cleanup: drop clusters whose last_updated_at < now() - 7d.
 * Members cascade. Returns deleted count.
 */
export async function deleteStaleClusters(
  supabase: SupabaseClient,
  category: CategoryEnum,
): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_AGE_DAYS * 24 * 3600 * 1000).toISOString()
  const { error, count } = await supabase
    .from('trend_clusters')
    .delete({ count: 'exact' })
    .eq('category', category)
    .lt('last_updated_at', cutoff)
  if (error) throw new Error(`deleteStaleClusters: ${error.message}`)
  return count ?? 0
}

/**
 * Compute avg trend_score across the cluster's member videos.
 * COALESCE NULL → 0; if every video lacks trend_score, returns 0 (Phase 6
 * will populate trend_score and this becomes meaningful).
 */
export async function computeAvgTrendScore(
  supabase: SupabaseClient,
  videoIds: string[],
): Promise<number> {
  if (videoIds.length === 0) return 0
  const { data, error } = await supabase
    .from('video_metrics')
    .select('trend_score')
    .in('video_id', videoIds)
  if (error) throw new Error(`computeAvgTrendScore: ${error.message}`)
  const scores = (data ?? [])
    .map((r: any) => (typeof r.trend_score === 'number' ? r.trend_score : null))
    .filter((s: number | null): s is number => s !== null)
  if (scores.length === 0) return 0
  const sum = scores.reduce((acc: number, x: number) => acc + x, 0)
  return sum / scores.length
}

/**
 * INSERT one cluster row + its members. Returns inserted cluster id.
 * Caller is responsible for `narrative_archetype_id` set in a follow-up
 * UPDATE (Phase 5C separates detect from archetype labelling).
 */
export async function insertCluster(
  supabase: SupabaseClient,
  category: CategoryEnum,
  cluster: ClusterCandidate,
  avgTrendScore: number,
): Promise<InsertedCluster> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('trend_clusters')
    .insert({
      category,
      video_count: cluster.members.length,
      channel_count: cluster.distinctChannelCount,
      first_seen_at: now,
      last_updated_at: now,
      avg_trend_score: avgTrendScore,
      is_mega_cluster: false,
      mega_cluster_categories: null,
      narrative_archetype_id: null,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`insertCluster: ${error?.message ?? 'no row returned'}`)

  const clusterId = (data as { id: number }).id
  const memberRows = cluster.members.map((m) => ({
    cluster_id: clusterId,
    video_id: m.videoId,
    similarity: m.similarity,
  }))
  if (memberRows.length > 0) {
    const { error: memErr } = await supabase
      .from('trend_cluster_members')
      .upsert(memberRows, { onConflict: 'cluster_id,video_id' })
    if (memErr) throw new Error(`insertCluster members: ${memErr.message}`)
  }
  return {
    id: clusterId,
    centroidVideoId: cluster.centroidVideoId,
    members: cluster.members,
  }
}

/**
 * Fetch latest title per video_id from video_snapshots.
 * Returns Map<video_id, title>. Videos without any snapshot title are absent.
 */
export async function fetchLatestTitles(
  supabase: SupabaseClient,
  videoIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (videoIds.length === 0) return out
  const { data, error } = await supabase
    .from('video_snapshots')
    .select('video_id, title, scanned_at')
    .in('video_id', videoIds)
    .order('scanned_at', { ascending: false })
  if (error) throw new Error(`fetchLatestTitles: ${error.message}`)
  for (const row of (data ?? []) as any[]) {
    const vid = row.video_id as string
    if (out.has(vid)) continue
    const t = (row.title as string | null)?.trim()
    if (t) out.set(vid, t)
  }
  return out
}

/**
 * UPDATE a cluster's narrative_archetype_id field.
 */
export async function setClusterArchetype(
  supabase: SupabaseClient,
  clusterId: number,
  archetypeId: string,
): Promise<void> {
  const { error } = await supabase
    .from('trend_clusters')
    .update({ narrative_archetype_id: archetypeId })
    .eq('id', clusterId)
  if (error) throw new Error(`setClusterArchetype: ${error.message}`)
}

/**
 * Increment narrative_archetypes.detection_count for an existing canonical
 * archetype. Returns true if the archetype exists and was incremented;
 * returns false if the slug is unknown (caller falls back to default).
 */
export async function incrementCanonicalArchetype(
  supabase: SupabaseClient,
  archetypeId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('narrative_archetypes')
    .select('id, detection_count, status')
    .eq('id', archetypeId)
    .maybeSingle()
  if (error) throw new Error(`incrementCanonicalArchetype lookup: ${error.message}`)
  if (!data) return false
  const row = data as { id: string; detection_count: number; status: string }
  if (row.status !== 'canonical') return false
  const { error: updErr } = await supabase
    .from('narrative_archetypes')
    .update({ detection_count: row.detection_count + 1 })
    .eq('id', archetypeId)
  if (updErr) throw new Error(`incrementCanonicalArchetype update: ${updErr.message}`)
  return true
}

/**
 * UPSERT a candidate archetype: insert with detection_count=1, or if it
 * already exists bump its detection_count by 1. Status stays 'candidate'
 * unless an admin promotes it.
 */
export async function upsertCandidateArchetype(
  supabase: SupabaseClient,
  archetypeId: string,
  displayLabel: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('narrative_archetypes')
    .select('id, detection_count')
    .eq('id', archetypeId)
    .maybeSingle()
  if (error) throw new Error(`upsertCandidateArchetype lookup: ${error.message}`)

  if (data) {
    const row = data as { id: string; detection_count: number }
    const { error: updErr } = await supabase
      .from('narrative_archetypes')
      .update({ detection_count: row.detection_count + 1 })
      .eq('id', archetypeId)
    if (updErr) throw new Error(`upsertCandidateArchetype update: ${updErr.message}`)
    return
  }
  const { error: insErr } = await supabase
    .from('narrative_archetypes')
    .insert({
      id: archetypeId,
      display_label: displayLabel,
      status: 'candidate',
      detection_count: 1,
    })
  if (insErr) throw new Error(`upsertCandidateArchetype insert: ${insErr.message}`)
}

/**
 * Reset all clusters' mega-cluster flags before re-evaluating cross-niche
 * archetypes. Cheap: schema indexes (status, last_updated_at) keep the
 * sweep small.
 */
export async function resetMegaClusterFlags(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase
    .from('trend_clusters')
    .update({ is_mega_cluster: false, mega_cluster_categories: null })
    .eq('is_mega_cluster', true)
  if (error) throw new Error(`resetMegaClusterFlags: ${error.message}`)
}

/**
 * Find archetypes that span ≥3 distinct categories within the last 7 days.
 * For each, mark all matching clusters as is_mega_cluster=true with the
 * cats array.
 */
export async function flagMegaClusters(supabase: SupabaseClient): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_AGE_DAYS * 24 * 3600 * 1000).toISOString()
  const { data, error } = await supabase
    .from('trend_clusters')
    .select('narrative_archetype_id, category')
    .not('narrative_archetype_id', 'is', null)
    .gt('last_updated_at', cutoff)
  if (error) throw new Error(`flagMegaClusters fetch: ${error.message}`)

  // Aggregate distinct categories per archetype in-memory.
  const catsByArchetype = new Map<string, Set<CategoryEnum>>()
  for (const row of (data ?? []) as any[]) {
    const aid = row.narrative_archetype_id as string | null
    const cat = row.category as CategoryEnum | null
    if (!aid || !cat) continue
    let set = catsByArchetype.get(aid)
    if (!set) {
      set = new Set<CategoryEnum>()
      catsByArchetype.set(aid, set)
    }
    set.add(cat)
  }

  let flagged = 0
  for (const [aid, cats] of Array.from(catsByArchetype.entries())) {
    if (cats.size < 3) continue
    const catsArr = Array.from(cats)
    const { error: updErr } = await supabase
      .from('trend_clusters')
      .update({ is_mega_cluster: true, mega_cluster_categories: catsArr })
      .eq('narrative_archetype_id', aid)
      .gt('last_updated_at', cutoff)
    if (updErr) throw new Error(`flagMegaClusters update ${aid}: ${updErr.message}`)
    flagged += cats.size
  }
  return flagged
}
