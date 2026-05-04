import { deriveReadinessOkFlags, TREND_READINESS_THRESHOLDS } from './queries'

describe('deriveReadinessOkFlags', () => {
  it('returns all-false when every metric is zero', () => {
    const out = deriveReadinessOkFlags({ snapshots: 0, coverage: 0, clusters: 0 })
    expect(out.videoSnapshotsOk).toBe(false)
    expect(out.embeddingOk).toBe(false)
    expect(out.clustersOk).toBe(false)
    expect(out.allOk).toBe(false)
  })

  it('returns all-true when every metric is exactly at threshold', () => {
    const out = deriveReadinessOkFlags({
      snapshots: TREND_READINESS_THRESHOLDS.videoSnapshots,
      coverage: TREND_READINESS_THRESHOLDS.embeddingCoverage,
      clusters: TREND_READINESS_THRESHOLDS.clustersFormed,
    })
    expect(out.videoSnapshotsOk).toBe(true)
    expect(out.embeddingOk).toBe(true)
    expect(out.clustersOk).toBe(true)
    expect(out.allOk).toBe(true)
  })

  it('keeps allOk=false when only some metrics pass', () => {
    // Snapshots above threshold, embeddings below, clusters above.
    const out = deriveReadinessOkFlags({
      snapshots: TREND_READINESS_THRESHOLDS.videoSnapshots + 100,
      coverage: 0.4,
      clusters: 5,
    })
    expect(out.videoSnapshotsOk).toBe(true)
    expect(out.embeddingOk).toBe(false)
    expect(out.clustersOk).toBe(true)
    expect(out.allOk).toBe(false)
  })

  it('treats coverage just below threshold (0.5999) as not OK', () => {
    const out = deriveReadinessOkFlags({ snapshots: 10000, coverage: 0.5999, clusters: 10 })
    expect(out.embeddingOk).toBe(false)
    expect(out.allOk).toBe(false)
  })

  it('treats coverage exactly at 0.6 as OK', () => {
    const out = deriveReadinessOkFlags({ snapshots: 10000, coverage: 0.6, clusters: 10 })
    expect(out.embeddingOk).toBe(true)
    expect(out.allOk).toBe(true)
  })

  it('echoes the input values + thresholds back on the result object', () => {
    const out = deriveReadinessOkFlags({ snapshots: 1234, coverage: 0.42, clusters: 0 })
    expect(out.videoSnapshots).toBe(1234)
    expect(out.embeddingCoverage).toBe(0.42)
    expect(out.clustersFormed).toBe(0)
    expect(out.videoSnapshotsThreshold).toBe(TREND_READINESS_THRESHOLDS.videoSnapshots)
    expect(out.embeddingThreshold).toBe(TREND_READINESS_THRESHOLDS.embeddingCoverage)
    expect(out.clustersThreshold).toBe(TREND_READINESS_THRESHOLDS.clustersFormed)
  })
})
