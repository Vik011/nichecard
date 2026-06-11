'use client'

import { useEffect, useState } from 'react'
import type { CopyKeys } from './copy'

interface HeroStatsBarProps {
  copy: CopyKeys
  spikedLast24h: number
}

/**
 * 3-column stats strip anchoring the bottom of the hero section. Frames
 * the system rhythm without burying real-time signals in floating
 * corner chips:
 *
 *   [  250+        ]  [  Next scan ━━━ 29:45  ]  [  1h        ]
 *   [  FACELESS    ]  [  36 SPIKED · LAST 24H ]  [  SCAN      ]
 *   [  CHANNELS …  ]  [                       ]  [  INTERVAL  ]
 *
 * Replaces the prior NextScanCountdown chip that lived isolated in the
 * bottom-left corner of HeroBackdrop. The center column carries a live
 * progress bar fed by the same "top of next hour" timer logic so the
 * visitor SEES the rhythm of the system, not just its name.
 * spikedLast24h is the real radar snapshot count (channels whose latest
 * scan in the past 24h flagged a spike) — never hardcode it.
 */
export function HeroStatsBar({ copy, spikedLast24h }: HeroStatsBarProps) {
  const { minutes, seconds, progressPct } = useNextScanCountdown()

  return (
    <div className="mt-8 sm:mt-12 max-w-3xl mx-auto px-2 grid grid-cols-[1fr_1.5fr_1fr] gap-4 sm:gap-6 items-center">
      {/* Left: faceless channels tracked. Static value verified against
          channels_watchlist (active faceless = 252 on 2026-06-11) — the
          table is auth-gated so the count can't be wired anon-side. */}
      <div className="flex flex-col items-center sm:items-start gap-1">
        <span className="font-display text-3xl sm:text-4xl text-ink leading-none">
          {copy.heroStatsChannelsValue}
        </span>
        <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          {copy.heroStatsChannelsScan}
        </span>
      </div>

      {/* Center: next scan progress + countdown + spiking-now.
          Gets 1.5fr column weight (vs 1fr for sides) so the live
          progress row breathes instead of feeling squeezed between
          the 230+ and 1h numerals. Inner max-width cap removed so
          the bar fills its cell. */}
      <div className="flex flex-col items-center gap-2">
        <div className="w-full flex items-center gap-2">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle whitespace-nowrap">
            {copy.heroStatsNextScan}
          </span>
          <div className="flex-1 h-1 rounded-full bg-surface-overlay overflow-hidden">
            <div
              className="h-full bg-accent-emerald-bright/80 transition-[width] duration-1000 ease-linear"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[12px] sm:text-[13px] font-semibold tabular-nums text-ink whitespace-nowrap">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-xl sm:text-2xl text-ink leading-none tabular-nums">
            {spikedLast24h}
          </span>
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
            {copy.heroStatsSpikingNow}
          </span>
        </div>
      </div>

      {/* Right: scan interval */}
      <div className="flex flex-col items-center sm:items-end gap-1">
        <span className="font-display text-3xl sm:text-4xl text-ink leading-none">
          {copy.heroStatsScanIntervalValue}
        </span>
        <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          {copy.heroStatsScanInterval}
        </span>
      </div>
    </div>
  )
}

/**
 * Live countdown to the top of the next hour (when the hourly-scan cron
 * fires). Re-renders every second on the client. progressPct is the
 * inverse of remaining time (0% at top of hour, 100% just before the
 * next tick).
 */
function useNextScanCountdown(): {
  minutes: number
  seconds: number
  progressPct: number
} {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  if (!now) {
    return { minutes: 0, seconds: 0, progressPct: 0 }
  }

  const elapsedMs =
    now.getMinutes() * 60 * 1000 +
    now.getSeconds() * 1000 +
    now.getMilliseconds()
  const remainingMs = 3600 * 1000 - elapsedMs
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const progressPct = Math.min(100, Math.max(0, (elapsedMs / (3600 * 1000)) * 100))

  return { minutes, seconds, progressPct }
}
