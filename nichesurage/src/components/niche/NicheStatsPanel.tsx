import type { NicheCardData } from '@/lib/types'
import type { CopyKeys } from '@/components/landing/copy'

interface NicheStatsPanelProps {
  niche: NicheCardData
  copy: CopyKeys
}

function formatK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

function ageMonths(createdAt: string): number {
  const created = new Date(createdAt)
  const now = new Date()
  return Math.max(0, Math.floor((now.getTime() - created.getTime()) / (30 * 24 * 60 * 60 * 1000)))
}

const eyebrow = 'text-[10px] font-semibold tracking-[0.22em] uppercase text-glow-indigo'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className={eyebrow + ' mb-2'}>{label}</div>
      <div className="text-2xl font-semibold text-slate-100 tabular-nums">{value}</div>
      {sub && <div className="text-slate-500 text-xs mt-1">{sub}</div>}
    </div>
  )
}

export function NicheStatsPanel({ niche, copy }: NicheStatsPanelProps) {
  const months = ageMonths(niche.channelCreatedAt)
  const ageLabel = months >= 12
    ? `${(months / 12).toFixed(1)} ${copy.statYears}`
    : `${months} ${copy.statMonths}`

  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <StatCard
        label={copy.statSubscribers}
        value={formatK(niche.subscriberCount)}
        sub={niche.subscriberRange}
      />
      <StatCard
        label={copy.statChannelAge}
        value={ageLabel}
      />
      <StatCard
        label={copy.statLanguage}
        value={niche.language.toUpperCase()}
      />
      <StatCard
        label={copy.statVideos}
        value={String(niche.videoCount)}
        sub={`${niche.spikeMultiplier}× ${copy.statSpike}`}
      />
    </section>
  )
}
