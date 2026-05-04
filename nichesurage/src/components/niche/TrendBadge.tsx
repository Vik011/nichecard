import type { TrendData, TrendLifecycle } from '@/lib/types/trend'
import { TREND_BADGE_SCORE_THRESHOLD, TREND_BADGE_CLUSTER_THRESHOLD } from '@/lib/types/trend'

const LIFECYCLE_STYLE: Record<TrendLifecycle, { label: string; cls: string }> = {
  emerging:  { label: 'Emerging',  cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  exploding: { label: 'Exploding', cls: 'bg-orange-500/15  text-orange-300  border-orange-500/30' },
  peak:      { label: 'Peak',      cls: 'bg-indigo-500/15  text-indigo-300  border-indigo-500/30' },
  saturated: { label: 'Saturated', cls: 'bg-amber-500/15   text-amber-300   border-amber-500/30' },
  dying:     { label: 'Dying',     cls: 'bg-slate-700/40   text-slate-400   border-slate-700' },
}

export interface TrendBadgeProps { data: TrendData }

export function TrendBadge({ data }: TrendBadgeProps) {
  const showByScore   = data.trendScore   >= TREND_BADGE_SCORE_THRESHOLD
  const showByCluster = data.clusterSize  >= TREND_BADGE_CLUSTER_THRESHOLD
  if (!showByScore && !showByCluster) return null

  const tooltip = [data.narrativeArchetypeLabel, data.clusterLabel].filter(Boolean).join(' • ')

  return (
    <div className="flex flex-wrap items-center gap-1.5" title={tooltip || undefined}>
      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-200">
        🔥 TRENDING
      </span>
      {data.lifecycleStatus && (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${LIFECYCLE_STYLE[data.lifecycleStatus].cls}`}>
          {LIFECYCLE_STYLE[data.lifecycleStatus].label}
        </span>
      )}
      {data.clusterSize >= TREND_BADGE_CLUSTER_THRESHOLD && (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${data.isMegaCluster ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
          {data.isMegaCluster ? '🚨 Cross-niche' : `${data.clusterSize} channels`}
        </span>
      )}
    </div>
  )
}
