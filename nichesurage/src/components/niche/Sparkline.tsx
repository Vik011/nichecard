import type { SpikePoint } from '@/lib/types'

export type SparklineTier = 'excellent' | 'strong' | 'average' | 'weak'

interface SparklineProps {
  data: SpikePoint[]
  variant: 'card' | 'detail'
  tier?: SparklineTier
}

const DIMENSIONS = {
  card:   { w: 80,  h: 24,  strokeW: 1.5 },
  detail: { w: 600, h: 120, strokeW: 2 },
} as const

const TIER_COLORS: Record<SparklineTier, { stroke: string; fill: string }> = {
  excellent: { stroke: 'rgb(6 182 212)',   fill: 'rgb(6 182 212)'   },
  strong:    { stroke: 'rgb(129 140 248)', fill: 'rgb(129 140 248)' },
  average:   { stroke: 'rgb(148 163 184)', fill: 'rgb(148 163 184)' },
  weak:      { stroke: 'rgb(248 113 113)', fill: 'rgb(248 113 113)' },
}

export function tierFromScore(score: number): SparklineTier {
  if (score >= 70) return 'excellent'
  if (score >= 50) return 'strong'
  if (score >= 30) return 'average'
  return 'weak'
}

export function Sparkline({ data, variant, tier = 'strong' }: SparklineProps) {
  if (data.length < 2) {
    return <span className="text-slate-600 text-xs tabular-nums">—</span>
  }
  const { w, h, strokeW } = DIMENSIONS[variant]
  const max = Math.max(...data.map(d => d.spikeX), 1)
  const stepX = w / (data.length - 1)
  const points = data
    .map((d, i) => `${(i * stepX).toFixed(2)},${(h - (d.spikeX / max) * h).toFixed(2)}`)
    .join(' ')
  const gradId = `spark-grad-${variant}-${tier}`
  const colors = TIER_COLORS[tier]

  return (
    <svg
      role="img"
      aria-label={`30-day spike trend, ${data.length} points`}
      data-tier={tier}
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.fill} stopOpacity="0.45" />
          <stop offset="100%" stopColor={colors.fill} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${points} ${w},${h}`}
        fill={`url(#${gradId})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={colors.stroke}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
