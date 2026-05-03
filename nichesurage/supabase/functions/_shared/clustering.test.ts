// supabase/functions/_shared/clustering.test.ts
import { assertEquals, assertAlmostEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { cosine, meanVector, updateCentroid, kmeans } from './clustering.ts'

Deno.test('cosine: identical vectors → 1', () => {
  assertAlmostEquals(cosine([1, 0, 0], [1, 0, 0]), 1, 1e-9)
})

Deno.test('cosine: orthogonal → 0', () => {
  assertAlmostEquals(cosine([1, 0], [0, 1]), 0, 1e-9)
})

Deno.test('cosine: zero vector → 0 (no NaN)', () => {
  assertEquals(cosine([0, 0, 0], [1, 2, 3]), 0)
})

Deno.test('meanVector: averages component-wise', () => {
  assertEquals(meanVector([[1, 2], [3, 4], [5, 6]]), [3, 4])
})

Deno.test('updateCentroid: moves toward new vec proportionally', () => {
  // prior = [0, 0] with 0 members; adding [4, 4] = new centroid [4, 4]
  assertEquals(updateCentroid([0, 0], 0, [4, 4]), [4, 4])
  // prior centroid [4, 4] with 1 member; adding [0, 0] = average [2, 2]
  assertEquals(updateCentroid([4, 4], 1, [0, 0]), [2, 2])
})

Deno.test('kmeans: two well-separated clusters get separate assignments', () => {
  const vecs = [
    [1, 0, 0], [0.95, 0.05, 0], [0.9, 0.1, 0],
    [0, 1, 0], [0.05, 0.95, 0], [0.1, 0.9, 0],
  ]
  const { assignments } = kmeans(vecs, 2)
  // Members 0..2 should share an assignment; 3..5 should share the other.
  assertEquals(assignments[0], assignments[1])
  assertEquals(assignments[1], assignments[2])
  assertEquals(assignments[3], assignments[4])
  assertEquals(assignments[4], assignments[5])
  // And the two halves should differ.
  assertEquals(assignments[0] === assignments[3], false)
})

Deno.test('kmeans: empty input returns empty', () => {
  const r = kmeans([], 3)
  assertEquals(r.assignments.length, 0)
  assertEquals(r.centroids.length, 0)
})

Deno.test('kmeans: k > n is clamped to n', () => {
  const r = kmeans([[1, 0], [0, 1]], 5)
  assertEquals(r.centroids.length, 2)
})
