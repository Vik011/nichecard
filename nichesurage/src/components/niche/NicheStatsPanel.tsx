import type { NicheCardData } from '@/lib/types'
import type { CopyKeys } from '@/components/landing/copy'

interface NicheStatsPanelProps {
  niche: NicheCardData
  copy: CopyKeys
  // PR 4: catalog-only detail (wl: card). Renders honest fields only — no
  // channel-age-from-empty-createdAt (NaN) and no spike multiplier (would be 0×).
  catalogOnly?: boolean
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

// PR 4: relative "last upload" label for catalog detail. Guards invalid/missing
// dates (returns null) so nothing renders rather than leaking NaN.
function lastUploadLabel(iso: string): string | null {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  const days = Math.floor((Date.now() - t) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} years ago`
}

const eyebrow = 'text-[10px] font-semibold tracking-[0.22em] uppercase text-accent-emerald-bright'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className={eyebrow + ' mb-2'}>{label}</div>
      <div className="text-2xl font-semibold text-ink tabular-nums">{value}</div>
      {sub && <div className="text-ink-subtle text-xs mt-1">{sub}</div>}
    </div>
  )
}

export function NicheStatsPanel({ niche, copy, catalogOnly }: NicheStatsPanelProps) {
  if (catalogOnly) {
    // Honest catalog stats only: subscribers, last upload (if known), language,
    // videos. No channel age (channelCreatedAt is empty for catalog rows → NaN)
    // and no spike multiplier (would be a fake 0×).
    const uploaded = niche.lastUploadAt ? lastUploadLabel(niche.lastUploadAt) : null
    return (
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label={copy.statSubscribers}
          value={formatK(niche.subscriberCount)}
          sub={niche.subscriberRange}
        />
        {uploaded && <StatCard label="Last upload" value={uploaded} />}
        <StatCard label={copy.statLanguage} value={niche.language.toUpperCase()} />
        <StatCard label={copy.statVideos} value={String(niche.videoCount)} />
      </section>
    )
  }

  const months = ageMonths(niche.channelCreatedAt)
  const ageLabel = months >= 12
    ? `${(months / 12).toFixed(1)} ${copy.statYears}`
    : `${months} ${copy.statMonths}`

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
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
