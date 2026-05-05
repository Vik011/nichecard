/**
 * Replication-cluster detection (Sprint B Phase 5B).
 *
 * Identifies groups of videos within a category whose titles, transcripts, or
 * thumbnails are mutually similar — a strong signal that multiple channels are
 * riding the same trend (i.e. real replication, not single-creator luck).
 *
 * Pipeline:
 *   1. Fetch candidate videos in `category` published within `hoursWindow`.
 *   2. Pull their embeddings and pHashes.
 *   3. Compute pairwise edges (any-signal triggers an edge):
 *        - title cosine similarity > 0.85
 *        - transcript cosine similarity > 0.80
 *        - thumbnail Hamming distance < 6
 *   4. Union-find (DSU) groups transitively connected videos.
 *   5. Filter clusters by size >= 5 AND distinctChannelCount >= 3.
 *   6. Pick centroid = most-connected member (lowest videoId on tie).
 *   7. Sort clusters by member count desc.
 *
 * Why JS-side pairwise computation (not SQL self-joins)?
 * Self-joins with pgvector `<=>` and `bit_count(a # b)` cannot be expressed
 * via the Supabase JS chained client; expressing them requires a Postgres
 * function, which is a schema change. For the typical 50–500 candidate
 * videos in a 48h window, N² (≈25k–250k pairs) is fast in pure JS.
 *
 * Vercel Node runtime — uses `@supabase/supabase-js` server client.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CategoryEnum } from '@/lib/types/database'
import { hammingDistance } from '@/lib/thumbnails/phash'

export interface ClusterMember {
  videoId: string
  /**
   * Strongest similarity edge from this member to ANY other cluster member.
   * NOT centroid-relative — a member can have a stronger link to a non-centroid neighbor.
   * Phase 5C persists this to `trend_cluster_members.similarity` as the
   * "how strongly does this video belong to this cluster" signal.
   */
  similarity: number
}

export interface ClusterCandidate {
  /** Most-connected video in the cluster (lowest videoId on edge-count tie). */
  centroidVideoId: string
  /** All cluster members, including the centroid. */
  members: ClusterMember[]
  distinctChannelCount: number
}

export interface Edge {
  a: string
  b: string
  signal: 'title' | 'thumbnail' | 'transcript'
  similarity: number
}

// Cluster-detection thresholds. Defaults match the Sprint B spec for a
// mature dataset (5000+ videos per category). For bootstrap (current scale,
// ~50 videos per category) the minimum sizes are too restrictive — every
// category yields zero clusters because a 5-video, 3-channel coincidence in
// 48h is statistically rare. The env vars below let us run looser bootstrap
// thresholds in production while keeping spec defaults for tests and local.
//
// Bootstrap recommendation (until /admin → "Active clusters" > 0):
//   CLUSTER_MIN_MEMBERS=3
//   CLUSTER_MIN_DISTINCT_CHANNELS=2
// Tighten back to 5 / 3 once we have 1000+ snapshots/category.
function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function envFloat(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = parseFloat(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const TITLE_SIM_THRESHOLD = envFloat('CLUSTER_TITLE_SIM_THRESHOLD', 0.85)
const TRANSCRIPT_SIM_THRESHOLD = envFloat('CLUSTER_TRANSCRIPT_SIM_THRESHOLD', 0.80)
const THUMBNAIL_HAMMING_THRESHOLD = envInt('CLUSTER_THUMBNAIL_HAMMING_THRESHOLD', 6)
const MIN_MEMBERS = envInt('CLUSTER_MIN_MEMBERS', 5)
const MIN_DISTINCT_CHANNELS = envInt('CLUSTER_MIN_DISTINCT_CHANNELS', 3)
const DEFAULT_HOURS_WINDOW = envInt('CLUSTER_HOURS_WINDOW', 48)

// ─── Cosine similarity (pure) ────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  const len = a.length
  for (let i = 0; i < len; i++) {
    const ai = a[i]
    const bi = b[i]
    dot += ai * bi
    na += ai * ai
    nb += bi * bi
  }
  if (na === 0 || nb === 0) return 0
  return dot / Math.sqrt(na * nb)
}

// ─── Disjoint Set Union (path compression + union by size) ───────────────

class DSU {
  private parent = new Map<string, string>()
  private size = new Map<string, number>()

  add(x: string): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x)
      this.size.set(x, 1)
    }
  }

  find(x: string): string {
    let root = x
    while (this.parent.get(root) !== root) root = this.parent.get(root)!
    // Path compression
    let cur = x
    while (cur !== root) {
      const next = this.parent.get(cur)!
      this.parent.set(cur, root)
      cur = next
    }
    return root
  }

  union(a: string, b: string): void {
    this.add(a)
    this.add(b)
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra === rb) return
    const sa = this.size.get(ra)!
    const sb = this.size.get(rb)!
    if (sa < sb) {
      this.parent.set(ra, rb)
      this.size.set(rb, sa + sb)
    } else {
      this.parent.set(rb, ra)
      this.size.set(ra, sa + sb)
    }
  }
}

// ─── Pure clusterer over pre-computed edges ──────────────────────────────

/**
 * Run union-find clustering over a pre-computed edge set, then filter and rank.
 *
 * INVARIANT: every videoId referenced in `edges` MUST also appear in `videoIds`.
 * If a stray edge references an unknown videoId, `find()` will infinite-loop.
 * `detectReplicationClusters` upholds this invariant by deriving edges only
 * from the same candidate set it passes as `videoIds`.
 *
 * @param videoIds - all candidate videos in this (category, window) batch
 * @param edges - any-signal edges; both endpoints must be in `videoIds`
 * @param channelOf - videoId → channelId map for distinct-channel filtering
 */
export function clusterFromEdges(
  videoIds: string[],
  edges: Edge[],
  channelOf: Record<string, string>,
): ClusterCandidate[] {
  if (videoIds.length === 0) return []

  const dsu = new DSU()
  for (const v of videoIds) dsu.add(v)
  for (const ed of edges) dsu.union(ed.a, ed.b)

  // Group node ids by their DSU root.
  const groups = new Map<string, string[]>()
  for (const v of videoIds) {
    const root = dsu.find(v)
    const arr = groups.get(root)
    if (arr) arr.push(v)
    else groups.set(root, [v])
  }

  // Index edges by (root, node) for centroid + per-member similarity.
  // For each node we track:
  //   - degree within its cluster (count of distinct neighbors)
  //   - max similarity of any incoming edge from a cluster mate
  const degree = new Map<string, number>()
  const bestSim = new Map<string, number>()
  for (const v of videoIds) {
    degree.set(v, 0)
    bestSim.set(v, 0)
  }
  // Track unique unordered pairs to count degree correctly even if multiple
  // signals report the same pair.
  const seenPairs = new Set<string>()
  for (const ed of edges) {
    const a = ed.a
    const b = ed.b
    if (dsu.find(a) !== dsu.find(b)) continue // shouldn't happen, defensive
    const key = a < b ? `${a}|${b}` : `${b}|${a}`
    if (!seenPairs.has(key)) {
      seenPairs.add(key)
      degree.set(a, (degree.get(a) ?? 0) + 1)
      degree.set(b, (degree.get(b) ?? 0) + 1)
    }
    if (ed.similarity > (bestSim.get(a) ?? 0)) bestSim.set(a, ed.similarity)
    if (ed.similarity > (bestSim.get(b) ?? 0)) bestSim.set(b, ed.similarity)
  }

  const out: ClusterCandidate[] = []
  const allGroups: string[][] = Array.from(groups.values())
  for (const members of allGroups) {
    if (members.length < MIN_MEMBERS) continue

    const channels = new Set<string>()
    for (const m of members) {
      const ch = channelOf[m]
      if (ch) channels.add(ch)
    }
    if (channels.size < MIN_DISTINCT_CHANNELS) continue

    // Centroid = highest degree, tie-break by lowest videoId.
    let centroid = members[0]
    let bestDeg = degree.get(centroid) ?? 0
    for (const m of members) {
      const d = degree.get(m) ?? 0
      if (d > bestDeg || (d === bestDeg && m < centroid)) {
        centroid = m
        bestDeg = d
      }
    }

    out.push({
      centroidVideoId: centroid,
      members: members.map((m) => ({
        videoId: m,
        similarity: bestSim.get(m) ?? 0,
      })),
      distinctChannelCount: channels.size,
    })
  }

  // Sort by size desc; on tie keep deterministic by centroid id asc.
  out.sort((a, b) => {
    if (b.members.length !== a.members.length) {
      return b.members.length - a.members.length
    }
    return a.centroidVideoId < b.centroidVideoId ? -1 : 1
  })
  return out
}

// ─── Edge construction from raw embeddings + phashes ─────────────────────

interface VideoRow {
  video_id: string
  channel_id: string | null
  category: CategoryEnum | null
}
// Title/transcript come back as either a parsed array or a pgvector-string
// like "[0.123, 0.456, ...]" depending on PostgREST quirks. The buildEdges
// parser below handles both shapes; types reflect that union.
interface EmbeddingRow {
  video_id: string
  title_embedding: number[] | string | null
  transcript_embedding: number[] | string | null
}
interface PhashRow {
  video_id: string
  phash: string | number | bigint
}

function toBigInt(v: string | number | bigint): bigint {
  if (typeof v === 'bigint') return v
  if (typeof v === 'number') return BigInt(v)
  // Postgres bigint is shipped as a string by supabase-js to avoid
  // JS number-precision loss. BigInt() handles both decimal strings.
  return BigInt(v)
}

/**
 * Parse a pgvector value as a number[]. PostgREST returns vectors as either
 * a JSON-serialized array or a Postgres array-literal string like
 * "[0.1,0.2,...]" depending on context. Diagnostic SQL confirmed that real
 * cosine similarity exists between many of our title vectors (Postgres-side
 * via the `<=>` operator), but this route's earlier `Array.isArray()` check
 * was rejecting every vector that came back as a string — emptying titleVecs
 * and producing zero edges across all categories. Returns null on any
 * unrecognized shape.
 */
function parseVector(v: unknown): number[] | null {
  if (Array.isArray(v) && v.length > 0) return v as number[]
  if (typeof v === 'string' && v.length > 2 && v.startsWith('[') && v.endsWith(']')) {
    try {
      const parsed = JSON.parse(v)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as number[]
    } catch {
      // Not JSON-shaped; fall through to null.
    }
  }
  return null
}

function buildEdges(
  videoIds: string[],
  embeddings: EmbeddingRow[],
  phashes: PhashRow[],
): Edge[] {
  const idSet = new Set(videoIds)
  const titleVecs: { id: string; vec: number[] }[] = []
  const transcriptVecs: { id: string; vec: number[] }[] = []
  for (const e of embeddings) {
    if (!idSet.has(e.video_id)) continue
    const titleVec = parseVector(e.title_embedding)
    if (titleVec) {
      titleVecs.push({ id: e.video_id, vec: titleVec })
    }
    const transcriptVec = parseVector(e.transcript_embedding)
    if (transcriptVec) {
      transcriptVecs.push({ id: e.video_id, vec: transcriptVec })
    }
  }
  const phashList: { id: string; h: bigint }[] = []
  for (const p of phashes) {
    if (!idSet.has(p.video_id)) continue
    try {
      phashList.push({ id: p.video_id, h: toBigInt(p.phash) })
    } catch {
      // Skip malformed phash rows.
    }
  }

  const edges: Edge[] = []

  // Title cosine
  // SCALING: O(N²) pairwise — fine to ~500 videos per (category, window). At ≥1000, push edge construction down to SQL via pgvector `<=>` and `bit_count(a # b)` (requires Postgres RPC).
  for (let i = 0; i < titleVecs.length; i++) {
    for (let j = i + 1; j < titleVecs.length; j++) {
      const sim = cosineSimilarity(titleVecs[i].vec, titleVecs[j].vec)
      if (sim > TITLE_SIM_THRESHOLD) {
        const a = titleVecs[i].id
        const b = titleVecs[j].id
        edges.push({ a: a < b ? a : b, b: a < b ? b : a, signal: 'title', similarity: sim })
      }
    }
  }

  // Transcript cosine
  for (let i = 0; i < transcriptVecs.length; i++) {
    for (let j = i + 1; j < transcriptVecs.length; j++) {
      const sim = cosineSimilarity(transcriptVecs[i].vec, transcriptVecs[j].vec)
      if (sim > TRANSCRIPT_SIM_THRESHOLD) {
        const a = transcriptVecs[i].id
        const b = transcriptVecs[j].id
        edges.push({ a: a < b ? a : b, b: a < b ? b : a, signal: 'transcript', similarity: sim })
      }
    }
  }

  // Thumbnail Hamming — express as similarity = 1 - dist/64 for downstream.
  for (let i = 0; i < phashList.length; i++) {
    for (let j = i + 1; j < phashList.length; j++) {
      const dist = hammingDistance(phashList[i].h, phashList[j].h)
      if (dist < THUMBNAIL_HAMMING_THRESHOLD) {
        const a = phashList[i].id
        const b = phashList[j].id
        const sim = 1 - dist / 64
        edges.push({ a: a < b ? a : b, b: a < b ? b : a, signal: 'thumbnail', similarity: sim })
      }
    }
  }

  return edges
}

// ─── Public entry point ──────────────────────────────────────────────────

/**
 * Detect replication clusters within a category over the recent window.
 *
 * Returns clusters (each ≥5 members, ≥3 distinct channels) sorted by member
 * count desc. Uses pgvector and pHash signals via Supabase service-role
 * client.
 */
export async function detectReplicationClusters(
  supabase: SupabaseClient,
  category: CategoryEnum,
  hoursWindow: number = DEFAULT_HOURS_WINDOW,
): Promise<ClusterCandidate[]> {
  // 1. Snapshots within window — gives us the candidate video_id set.
  const cutoff = new Date(Date.now() - hoursWindow * 60 * 60 * 1000).toISOString()
  const { data: snapRows, error: snapErr } = await supabase
    .from('video_snapshots')
    .select('video_id, published_at')
    .gt('published_at', cutoff)
  if (snapErr) throw new Error(`detect: video_snapshots query failed: ${snapErr.message}`)
  const windowedIds = new Set<string>((snapRows ?? []).map((r: any) => r.video_id))
  if (windowedIds.size === 0) return []

  // 2. video_metrics filtered by category — channel + category sourcing.
  const { data: metricsRows, error: metricsErr } = await supabase
    .from('video_metrics')
    .select('video_id, channel_id, category')
    .eq('category', category)
  if (metricsErr) throw new Error(`detect: video_metrics query failed: ${metricsErr.message}`)
  const metrics: VideoRow[] = (metricsRows ?? []).filter((r: any) => windowedIds.has(r.video_id))
  if (metrics.length === 0) return []

  const candidateIds = metrics.map((r) => r.video_id)
  const channelOf: Record<string, string> = {}
  for (const r of metrics) {
    if (r.channel_id) channelOf[r.video_id] = r.channel_id
  }

  // 3. Embeddings + pHashes for the candidate set.
  const { data: embRows, error: embErr } = await supabase
    .from('video_embeddings')
    .select('video_id, title_embedding, transcript_embedding')
    .in('video_id', candidateIds)
  if (embErr) throw new Error(`detect: video_embeddings query failed: ${embErr.message}`)

  const { data: phashRows, error: phashErr } = await supabase
    .from('video_thumbnail_phash')
    .select('video_id, phash')
    .in('video_id', candidateIds)
  if (phashErr) throw new Error(`detect: video_thumbnail_phash query failed: ${phashErr.message}`)

  // 4. Build edges & cluster.
  const edges = buildEdges(
    candidateIds,
    (embRows ?? []) as EmbeddingRow[],
    (phashRows ?? []) as PhashRow[],
  )
  console.log(
    '[clusters/detect] category sizes',
    JSON.stringify({
      category,
      windowedIds: windowedIds.size,
      candidates: candidateIds.length,
      embeddingRows: (embRows ?? []).length,
      phashRows: (phashRows ?? []).length,
      edgesBuilt: edges.length,
      titleEdges: edges.filter((e) => e.signal === 'title').length,
      transcriptEdges: edges.filter((e) => e.signal === 'transcript').length,
      thumbnailEdges: edges.filter((e) => e.signal === 'thumbnail').length,
    }),
  )
  return clusterFromEdges(candidateIds, edges, channelOf)
}
