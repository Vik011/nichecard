/**
 * @jest-environment node
 */

jest.mock('image-hash', () => ({
  imageHash: jest.fn(),
}))

import {
  clusterFromEdges,
  detectReplicationClusters,
  type Edge,
} from './detect'

/**
 * Build a synthetic edge set. Helper avoids repeating the verbose
 * { a, b, signal, similarity } object literal across cases.
 */
function e(a: string, b: string, signal: 'title' | 'thumbnail' | 'transcript', sim: number): Edge {
  return { a, b, signal, similarity: sim }
}

describe('clusters/detect — clusterFromEdges (algorithm)', () => {
  it('5 same-channel videos with strong title edges → 0 clusters (only 1 distinct channel)', () => {
    const videoIds = ['v1', 'v2', 'v3', 'v4', 'v5']
    const channelOf = { v1: 'c1', v2: 'c1', v3: 'c1', v4: 'c1', v5: 'c1' }
    const edges: Edge[] = [
      e('v1', 'v2', 'title', 0.92),
      e('v1', 'v3', 'title', 0.91),
      e('v2', 'v4', 'title', 0.90),
      e('v3', 'v5', 'title', 0.89),
    ]
    const out = clusterFromEdges(videoIds, edges, channelOf)
    expect(out).toEqual([])
  })

  it('5 videos / 5 channels / strong title sim → 1 cluster of 5, distinctChannelCount=5', () => {
    const videoIds = ['v1', 'v2', 'v3', 'v4', 'v5']
    const channelOf = { v1: 'c1', v2: 'c2', v3: 'c3', v4: 'c4', v5: 'c5' }
    const edges: Edge[] = [
      e('v1', 'v2', 'title', 0.92),
      e('v2', 'v3', 'title', 0.91),
      e('v3', 'v4', 'title', 0.90),
      e('v4', 'v5', 'title', 0.93),
    ]
    const out = clusterFromEdges(videoIds, edges, channelOf)
    expect(out.length).toBe(1)
    expect(out[0].members.length).toBe(5)
    expect(out[0].distinctChannelCount).toBe(5)
    expect(new Set(out[0].members.map((m) => m.videoId))).toEqual(
      new Set(['v1', 'v2', 'v3', 'v4', 'v5'])
    )
  })

  it('3 unrelated videos with no edges → 0 clusters (below member threshold)', () => {
    const videoIds = ['v1', 'v2', 'v3']
    const channelOf = { v1: 'c1', v2: 'c2', v3: 'c3' }
    const out = clusterFromEdges(videoIds, [], channelOf)
    expect(out).toEqual([])
  })

  it('two distinct cross-channel groups → 2 clusters, sorted by size desc', () => {
    const videoIds = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'b1', 'b2', 'b3', 'b4', 'b5']
    const channelOf = {
      a1: 'ca1', a2: 'ca2', a3: 'ca3', a4: 'ca4', a5: 'ca5', a6: 'ca6',
      b1: 'cb1', b2: 'cb2', b3: 'cb3', b4: 'cb4', b5: 'cb5',
    }
    const edges: Edge[] = [
      // group A — 6 nodes by title
      e('a1', 'a2', 'title', 0.91),
      e('a2', 'a3', 'title', 0.92),
      e('a3', 'a4', 'title', 0.90),
      e('a4', 'a5', 'title', 0.93),
      e('a5', 'a6', 'title', 0.91),
      // group B — 5 nodes by thumbnail
      e('b1', 'b2', 'thumbnail', 0.95),
      e('b2', 'b3', 'thumbnail', 0.94),
      e('b3', 'b4', 'thumbnail', 0.96),
      e('b4', 'b5', 'thumbnail', 0.93),
    ]
    const out = clusterFromEdges(videoIds, edges, channelOf)
    expect(out.length).toBe(2)
    expect(out[0].members.length).toBe(6)
    expect(out[1].members.length).toBe(5)
    expect(out[0].distinctChannelCount).toBe(6)
    expect(out[1].distinctChannelCount).toBe(5)
  })

  it('any-signal triggers an edge (caller responsibility — already-thresholded edges form clusters)', () => {
    // Caller supplies only edges that already pass thresholds; the algorithm
    // does not re-apply thresholds. This test confirms a thumbnail-only edge
    // unions the two videos into the cluster.
    const videoIds = ['v1', 'v2', 'v3', 'v4', 'v5']
    const channelOf = { v1: 'c1', v2: 'c2', v3: 'c3', v4: 'c4', v5: 'c5' }
    const edges: Edge[] = [
      e('v1', 'v2', 'thumbnail', 0.97), // thumbnail-only edge
      e('v2', 'v3', 'title', 0.88),
      e('v3', 'v4', 'transcript', 0.82),
      e('v4', 'v5', 'thumbnail', 0.95),
    ]
    const out = clusterFromEdges(videoIds, edges, channelOf)
    expect(out.length).toBe(1)
    expect(out[0].members.length).toBe(5)
  })

  it('transitive grouping via different signals: A-B (title) + B-C (transcript) → A-B-C one cluster', () => {
    const videoIds = ['a', 'b', 'c', 'd', 'e']
    const channelOf = { a: 'c1', b: 'c2', c: 'c3', d: 'c4', e: 'c5' }
    const edges: Edge[] = [
      e('a', 'b', 'title', 0.92),
      e('b', 'c', 'transcript', 0.85),
      // No direct a-c edge — DSU should still merge.
      e('c', 'd', 'title', 0.91),
      e('d', 'e', 'thumbnail', 0.97),
    ]
    const out = clusterFromEdges(videoIds, edges, channelOf)
    expect(out.length).toBe(1)
    expect(out[0].members.length).toBe(5)
    const ids = new Set(out[0].members.map((m) => m.videoId))
    expect(ids.has('a') && ids.has('b') && ids.has('c')).toBe(true)
  })

  it('centroid is the most-connected video within the cluster', () => {
    // X has 4 edges to others; rest have 1-2.
    const videoIds = ['X', 'p', 'q', 'r', 's']
    const channelOf = { X: 'c1', p: 'c2', q: 'c3', r: 'c4', s: 'c5' }
    const edges: Edge[] = [
      e('X', 'p', 'title', 0.91),
      e('X', 'q', 'title', 0.92),
      e('X', 'r', 'title', 0.93),
      e('X', 's', 'title', 0.94),
      e('p', 'q', 'title', 0.86), // p has 2 edges, q has 2, r has 1, s has 1
    ]
    const out = clusterFromEdges(videoIds, edges, channelOf)
    expect(out.length).toBe(1)
    expect(out[0].centroidVideoId).toBe('X')
    expect(out[0].members.length).toBe(5)
  })

  it('centroid tie-break: lowest videoId wins when edge counts are equal', () => {
    const videoIds = ['z', 'a', 'm', 'p', 'q']
    const channelOf = { z: 'c1', a: 'c2', m: 'c3', p: 'c4', q: 'c5' }
    // Make every node have exactly 2 edges (a 5-cycle).
    const edges: Edge[] = [
      e('z', 'a', 'title', 0.91),
      e('a', 'm', 'title', 0.91),
      e('m', 'p', 'title', 0.91),
      e('p', 'q', 'title', 0.91),
      e('q', 'z', 'title', 0.91),
    ]
    const out = clusterFromEdges(videoIds, edges, channelOf)
    expect(out.length).toBe(1)
    // Lexicographically smallest id is "a"
    expect(out[0].centroidVideoId).toBe('a')
  })

  it('cluster of exactly 4 cross-channel videos is rejected (below member threshold)', () => {
    const videoIds = ['v1', 'v2', 'v3', 'v4']
    const channelOf = { v1: 'c1', v2: 'c2', v3: 'c3', v4: 'c4' }
    const edges: Edge[] = [
      e('v1', 'v2', 'title', 0.92),
      e('v2', 'v3', 'title', 0.91),
      e('v3', 'v4', 'title', 0.90),
    ]
    const out = clusterFromEdges(videoIds, edges, channelOf)
    expect(out).toEqual([])
  })

  it('cluster of 5 videos but only 2 distinct channels is rejected', () => {
    const videoIds = ['v1', 'v2', 'v3', 'v4', 'v5']
    const channelOf = { v1: 'c1', v2: 'c1', v3: 'c1', v4: 'c2', v5: 'c2' }
    const edges: Edge[] = [
      e('v1', 'v2', 'title', 0.92),
      e('v2', 'v3', 'title', 0.91),
      e('v3', 'v4', 'title', 0.90),
      e('v4', 'v5', 'title', 0.93),
    ]
    const out = clusterFromEdges(videoIds, edges, channelOf)
    expect(out).toEqual([])
  })

  it('empty videoIds → []', () => {
    expect(clusterFromEdges([], [], {})).toEqual([])
  })

  it('member similarity = strongest edge into that node (within cluster)', () => {
    const videoIds = ['X', 'p', 'q', 'r', 's']
    const channelOf = { X: 'c1', p: 'c2', q: 'c3', r: 'c4', s: 'c5' }
    const edges: Edge[] = [
      e('X', 'p', 'title', 0.91),
      e('X', 'q', 'title', 0.92),
      e('X', 'r', 'title', 0.93),
      e('X', 's', 'title', 0.94),
      e('p', 'q', 'title', 0.86),
    ]
    const out = clusterFromEdges(videoIds, edges, channelOf)
    expect(out.length).toBe(1)
    const byId = new Map(out[0].members.map((m) => [m.videoId, m]))
    // s has only one edge into X with sim 0.94 → similarity = 0.94
    expect(byId.get('s')!.similarity).toBeCloseTo(0.94, 3)
    // p has two edges (X@0.91 and q@0.86) → strongest = 0.91
    expect(byId.get('p')!.similarity).toBeCloseTo(0.91, 3)
  })
})

// ─── Mocked Supabase integration test ────────────────────────────────────

/**
 * Minimal supabase client mock — supports the chained calls used by
 * detectReplicationClusters: from(table).select(cols).gt/eq/in/...
 *
 * We capture the last `from()` table name and return the canned dataset for
 * that table. Filters are not applied — tests provide pre-filtered data.
 */
function makeMockSupabase(rowsByTable: Record<string, any[]>) {
  function builder(table: string): any {
    const data = rowsByTable[table] ?? []
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      gt: () => chain,
      in: () => chain,
      not: () => chain,
      then: (resolve: any) => resolve({ data, error: null }),
    }
    return chain
  }
  return { from: (t: string) => builder(t) } as any
}

describe('clusters/detect — detectReplicationClusters (supabase integration)', () => {
  it('returns [] when no candidate videos in window', async () => {
    const supabase = makeMockSupabase({
      video_snapshots: [],
      video_metrics: [],
      video_embeddings: [],
      video_thumbnail_phash: [],
    })
    const out = await detectReplicationClusters(supabase, 'ai_tools', 48)
    expect(out).toEqual([])
  })

  it('detects a 5-video cross-channel cluster from title-embedding similarity', async () => {
    // Construct 5 videos with near-identical title embeddings. Use simple unit
    // vectors so cosine similarity is easy to reason about.
    const baseVec = new Array(1536).fill(0)
    baseVec[0] = 1
    const variant = (i: number) => {
      const v = baseVec.slice()
      // tiny perturbation keeps cosine > 0.9999
      v[1 + i] = 0.001
      return v
    }
    const now = new Date().toISOString()
    const supabase = makeMockSupabase({
      video_snapshots: [
        { video_id: 'v1', published_at: now },
        { video_id: 'v2', published_at: now },
        { video_id: 'v3', published_at: now },
        { video_id: 'v4', published_at: now },
        { video_id: 'v5', published_at: now },
      ],
      video_metrics: [
        { video_id: 'v1', channel_id: 'c1', category: 'ai_tools' },
        { video_id: 'v2', channel_id: 'c2', category: 'ai_tools' },
        { video_id: 'v3', channel_id: 'c3', category: 'ai_tools' },
        { video_id: 'v4', channel_id: 'c4', category: 'ai_tools' },
        { video_id: 'v5', channel_id: 'c5', category: 'ai_tools' },
      ],
      video_embeddings: [
        { video_id: 'v1', title_embedding: variant(0), transcript_embedding: null },
        { video_id: 'v2', title_embedding: variant(1), transcript_embedding: null },
        { video_id: 'v3', title_embedding: variant(2), transcript_embedding: null },
        { video_id: 'v4', title_embedding: variant(3), transcript_embedding: null },
        { video_id: 'v5', title_embedding: variant(4), transcript_embedding: null },
      ],
      video_thumbnail_phash: [],
    })
    const out = await detectReplicationClusters(supabase, 'ai_tools', 48)
    expect(out.length).toBe(1)
    expect(out[0].members.length).toBe(5)
    expect(out[0].distinctChannelCount).toBe(5)
  })
})
