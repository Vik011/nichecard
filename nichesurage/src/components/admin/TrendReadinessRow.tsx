// Visual readout of the three trend-engine bootstrap thresholds.
// Pure presentational; runs server-side (no interactivity needed).

import type { TrendEngineReadiness } from '@/lib/admin/queries'

interface TrendReadinessRowProps {
  readiness: TrendEngineReadiness
}

export function TrendReadinessRow({ readiness }: TrendReadinessRowProps) {
  const rows: Array<{ label: string; current: string; target: string; ok: boolean }> = [
    {
      label: 'Video snapshots',
      current: readiness.videoSnapshots.toLocaleString(),
      target: readiness.videoSnapshotsThreshold.toLocaleString(),
      ok: readiness.videoSnapshotsOk,
    },
    {
      label: 'Embedding coverage',
      current: `${(readiness.embeddingCoverage * 100).toFixed(0)}%`,
      target: `${(readiness.embeddingThreshold * 100).toFixed(0)}%`,
      ok: readiness.embeddingOk,
    },
    {
      label: 'Clusters formed',
      current: readiness.clustersFormed.toLocaleString(),
      target: readiness.clustersThreshold.toLocaleString(),
      ok: readiness.clustersOk,
    },
  ]

  return (
    <div className="rounded-xl border border-slate-800/60 bg-charcoal-900/60 p-5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
        Bootstrap thresholds
      </div>
      <ul className="mt-3 divide-y divide-slate-800/50">
        {rows.map((r) => (
          <li
            key={r.label}
            className="flex items-center justify-between gap-4 py-2 text-sm"
          >
            <span className="text-slate-300">{r.label}</span>
            <span
              className={`flex items-center gap-2 font-mono text-xs ${
                r.ok ? 'text-emerald-300' : 'text-amber-300'
              }`}
            >
              <span>
                {r.current} / {r.target}
              </span>
              <span aria-hidden>{r.ok ? '✓' : '⚠'}</span>
            </span>
          </li>
        ))}
      </ul>
      <div
        className={
          readiness.allOk
            ? 'mt-4 rounded-lg border border-emerald-900/50 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-300'
            : 'mt-4 rounded-lg border border-slate-800/60 bg-charcoal-900/40 px-4 py-2 text-sm text-slate-400'
        }
      >
        {readiness.allOk ? (
          <>
            <strong>Engine warm</strong> — flip{' '}
            <code className="font-mono text-emerald-200">
              NEXT_PUBLIC_TREND_ENGINE_BOOTSTRAPPED=true
            </code>{' '}
            and redeploy.
          </>
        ) : (
          <>
            <strong>Engine still calibrating.</strong> Re-check in ~24h.
          </>
        )}
      </div>
    </div>
  )
}
