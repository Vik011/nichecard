import type { SpikePoint } from '@/lib/types'
import type { CopyKeys } from '@/components/landing/copy'
import { Sparkline, type SparklineTier } from './Sparkline'

interface PerformanceChartProps {
  history: SpikePoint[]
  copy: CopyKeys
  tier?: SparklineTier
}

const eyebrow = 'text-[10px] font-semibold tracking-[0.22em] uppercase text-glow-violet'

function formatDay(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function PerformanceChart({ history, copy, tier }: PerformanceChartProps) {
  if (history.length < 2) {
    return (
      <section className="glass rounded-2xl p-6 mb-6">
        <div className={eyebrow + ' mb-3'}>{copy.chartTitle}</div>
        <p className="text-slate-500 text-sm text-center py-8">
          {copy.chartEmpty}
        </p>
      </section>
    )
  }

  const maxSpike = Math.max(...history.map(p => p.spikeX))
  const first = history[0]
  const last = history[history.length - 1]

  return (
    <section className="glass rounded-2xl p-6 mb-6">
      <div className={eyebrow + ' mb-4'}>{copy.chartTitle}</div>
      <div className="flex justify-center mb-4">
        <Sparkline data={history} variant="detail" tier={tier} />
      </div>
      <div className="flex justify-between text-slate-500 text-xs tabular-nums mt-2 px-2">
        <span>{formatDay(first.day)}</span>
        <span className="text-violet-300">
          {copy.chartMaxSpike}: <span className="font-semibold">{maxSpike.toFixed(1)}×</span>
        </span>
        <span>{formatDay(last.day)}</span>
      </div>
    </section>
  )
}
