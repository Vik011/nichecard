// supabase/functions/_shared/clustering.ts
// Cosine similarity + tiny mini-batch KMeans for grouping outlier embeddings
// into niche clusters. Pure functions — exported for unit tests.

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('cosine: dim mismatch')
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export function meanVector(vecs: number[][]): number[] {
  if (vecs.length === 0) return []
  const dim = vecs[0].length
  const out = new Array<number>(dim).fill(0)
  for (const v of vecs) {
    for (let i = 0; i < dim; i++) out[i] += v[i]
  }
  for (let i = 0; i < dim; i++) out[i] /= vecs.length
  return out
}

// Update a running centroid given the prior centroid, prior member count, and a
// new vector. Equivalent to (oldCentroid * n + newVec) / (n + 1) but stable.
export function updateCentroid(centroid: number[], priorCount: number, vec: number[]): number[] {
  const next = new Array<number>(centroid.length)
  const denom = priorCount + 1
  for (let i = 0; i < centroid.length; i++) {
    next[i] = (centroid[i] * priorCount + vec[i]) / denom
  }
  return next
}

// Mini-batch KMeans. Tiny by design — used on at most ~50 orphans per run.
// Returns assignments[i] = cluster index in [0, k).
export function kmeans(
  vecs: number[][],
  k: number,
  iters = 8,
  seed = 1
): { centroids: number[][]; assignments: number[] } {
  if (vecs.length === 0) return { centroids: [], assignments: [] }
  const dim = vecs[0].length
  k = Math.min(k, vecs.length)

  // Deterministic init: spread initial picks across the input.
  const rng = lcg(seed)
  const seedIdx = new Set<number>()
  while (seedIdx.size < k) seedIdx.add(Math.floor(rng() * vecs.length))
  let centroids = [...seedIdx].map(i => vecs[i].slice())

  let assignments = new Array<number>(vecs.length).fill(0)

  for (let it = 0; it < iters; it++) {
    // Assign step.
    let changed = false
    for (let i = 0; i < vecs.length; i++) {
      let best = 0, bestSim = -Infinity
      for (let c = 0; c < k; c++) {
        const s = cosine(vecs[i], centroids[c])
        if (s > bestSim) { bestSim = s; best = c }
      }
      if (assignments[i] !== best) {
        assignments[i] = best
        changed = true
      }
    }

    // Update step — move each centroid to mean of its members. Empty
    // clusters keep their previous centroid (avoids NaN).
    const buckets: number[][][] = Array.from({ length: k }, () => [])
    for (let i = 0; i < vecs.length; i++) buckets[assignments[i]].push(vecs[i])
    centroids = centroids.map((prev, c) => buckets[c].length > 0 ? meanVector(buckets[c]) : prev)

    if (!changed) break

    // Silence the unused-var lint when iters reaches max.
    void dim
  }

  return { centroids, assignments }
}

// Linear-congruential PRNG so init is deterministic across runs without
// pulling in a dep. Good enough for cluster seeding.
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}
