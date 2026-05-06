'use client'

import { useEffect, useState } from 'react'
import type { CopyKeys } from './copy'

interface HeroStatsBarProps {
  copy: CopyKeys
  spikingNow: number
}

/**
 * 3-column stats strip anchoring the bottom of the hero section. Frames
 * the system rhythm without burying real-time signals in floating
 * corner chips:
 *
 *   [  230+        ]  [  Next scan ━━━ 29:45  ]  [  1h        ]
 *   [  CHANNELS    ]  [  47 SPIKING NOW       ]  [  SCAN      ]
 *   [  / SCAN      ]  [                       ]  [  INTERVAL  ]
 *
 * Replaces the prior NextScanCountdown chip that lived isolated in the
 * bottom-left corner of HeroBackdrop. The center column carries a live
 * progress bar fed by the same "top of next hour" timer logic so the
 * visitor SEES the rhythm of the system, not just its name.
 */
export function HeroStatsBar({ copy, spikingNow }: HeroStatsBarProps) {
  const { minutes, seconds, progressPct } = useNextScanCountdown()

  return (
    <div className="mt-12 sm:mt-16 max-w-3xl mx-auto px-2 grid grid-cols-3 gap-4 sm:gap-6 items-center">
      {/* Left: channels per scan */}
      <div className="flex flex-col items-center sm:items-start gap-1">
        <span className="font-display text-3xl sm:text-4xl text-slate-100 leading-none">
          230+
        </span>
        <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {copy.heroStatsChannelsScan}
        </span>
      </div>

      {/* Center: next scan progress + countdown + spiking-now */}
      <div className="flex flex-col items-center gap-2">
        <div className="w-full max-w-[200px] flex items-center gap-2">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 whitespace-nowrap">
            {copy.heroStatsNextScan}
          </span>
          <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-glow-indigo to-glow-cyan transition-[width] duration-1000 ease-linear"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[12px] sm:text-[13px] font-semibold tabular-nums text-slate-200 whitespace-nowrap">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-xl sm:text-2xl text-slate-100 leading-none tabular-nums">
            {spikingNow}
          </span>
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {copy.heroStatsSpikingNow}
          </span>
        </div>
      </div>

      {/* Right: scan interval */}
      <div className="flex flex-col items-center sm:items-end gap-1">
        <span className="font-display text-3xl sm:text-4xl text-slate-100 leading-none">
          {copy.heroStatsScanIntervalValue}
        </span>
        <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
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
