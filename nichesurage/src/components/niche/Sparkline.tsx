import type { SpikePoint } from '@/lib/types'

interface SparklineProps {
  data: SpikePoint[]
  variant: 'card' | 'detail'
}

const DIMENSIONS = {
  card:   { w: 80,  h: 24,  strokeW: 1.5 },
  detail: { w: 600, h: 120, strokeW: 2 },
} as const

export function Sparkline({ data, variant }: SparklineProps) {
  if (data.length < 2) {
    return <span className="text-slate-600 text-xs tabular-nums">—</span>
  }
  const { w, h, strokeW } = DIMENSIONS[variant]
  const max = Math.max(...data.map(d => d.spikeX), 1)
  const stepX = w / (data.length - 1)
  const points = data
    .map((d, i) => `${(i * stepX).toFixed(2)},${(h - (d.spikeX / max) * h).toFixed(2)}`)
    .join(' ')
  const gradId = `spark-grad-${variant}`

  return (
    <svg
      role="img"
      aria-label={`30-day spike trend, ${data.length} points`}
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(167 139 250)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="rgb(167 139 250)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${points} ${w},${h}`}
        fill={`url(#${gradId})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke="rgb(167 139 250)"
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
