// SpikingBadge — pulsing red "SPIKING NOW" pill rendered on the highest-ratio
// niches (default: outlier_ratio >= SPIKING_NOW_THRESHOLD = 10). The animated
// ping is the single most important "alive" UX hook in /discover.

interface SpikingBadgeProps {
  label?: string
  size?: 'sm' | 'md'
}

export function SpikingBadge({ label = 'Spiking Now', size = 'sm' }: SpikingBadgeProps) {
  const padding = size === 'md' ? 'px-2.5 py-1 text-[11px]' : 'px-2 py-0.5 text-[10px]'
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-flex items-center gap-1.5 rounded-full bg-red-500/15 ring-1 ring-red-500/40 text-red-300 font-semibold tracking-[0.18em] uppercase ${padding}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping motion-reduce:animate-none" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
      </span>
      {label}
    </span>
  )
}
