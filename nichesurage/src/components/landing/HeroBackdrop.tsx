'use client'

// HeroBackdrop layers the live radar visual behind the hero copy and floats
// telemetry overlays in three corners (top-left, bottom-left, bottom-right)
// to balance the hero stage. Hero text reads on top.

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CopyKeys } from './copy'
import type { RadarPing } from '@/lib/landing/fetchRadarPings'

interface HeroBackdropProps {
  copy: CopyKeys
  pings: RadarPing[]
  channelsLast24h: number
}

const ROTATION_MS = 3200

export function HeroBackdrop({ copy, pings, channelsLast24h }: HeroBackdropProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (pings.length === 0) return
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const ms = reduced ? ROTATION_MS * 2 : ROTATION_MS
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % pings.length)
    }, ms)
    return () => window.clearInterval(t)
  }, [pings.length])

  const current = pings[index]

  return (
    <>
      {/* Layer 0 — radar dish, centered behind the hero copy. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="opacity-[0.55]">
          <RadarVisual />
        </div>
      </div>

      {/* Layer 1 — radial fade so the radar feathers into the page bg. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at center, transparent 22%, rgba(6,9,16,0.55) 60%, rgba(6,9,16,0.95) 88%)',
        }}
      />

      {/* Layer 2 — ambient horizontal scan line that sweeps top→bottom every
          10s. Subtle "system is online" telemetry without constant motion. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
        <div className="scan-line" />
      </div>

      {/* Layer 3 — TOP-LEFT: floating LIVE counter chip.
          Defensive structure: outer div owns the absolute positioning,
          inner div owns the chip styling. Mixing display:flex with
          position:absolute on the same element was producing erratic
          positioning in production (chip stretching across viewport
          and ignoring its `top-8 left-8` anchor). */}
      <div className="absolute top-8 left-8 z-20 hidden md:block">
        <div className="inline-flex items-center gap-2 bg-charcoal-900/70 backdrop-blur-md gborder rounded-full px-4 py-2 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]">
          <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="text-emerald-300/95 text-[10px] font-semibold uppercase tracking-[0.22em]">
            {copy.radarLive}
          </span>
          <span className="text-slate-300 text-[12px] font-medium whitespace-nowrap">
            · {copy.radarChannelsLast24h(channelsLast24h)}
          </span>
        </div>
      </div>

      {/* Layer 4 — BOTTOM-LEFT: next-scan countdown. Dopamine driver — gives
          the visitor a reason to wait or come back. */}
      <NextScanCountdown copy={copy} />

      {/* Layer 5 — BOTTOM-RIGHT: floating "channel discovered" notification. */}
      <div
        className="absolute bottom-8 right-8 z-20 hidden md:block w-[300px] min-h-[100px]"
        aria-live="polite"
        aria-atomic="true"
      >
        <AnimatePresence mode="wait">
          {current ? (
            <motion.div
              key={current.id + ':' + index}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="bg-charcoal-900/80 backdrop-blur-md gborder rounded-2xl p-4 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.6)]"
            >
              <div className="flex items-start gap-3">
                <div className="relative shrink-0 mt-1.5">
                  <span aria-hidden className="absolute inset-0 -m-1 rounded-full bg-glow-cyan/30 animate-ping" />
                  <span aria-hidden className="relative block w-2 h-2 rounded-full bg-glow-cyan shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-glow-cyan text-[9px] font-semibold uppercase tracking-[0.22em] mb-1">
                    {copy.radarPingPrefix}
                  </div>
                  <div className="text-slate-100 text-lg font-semibold tracking-tight tabular-nums leading-none mb-1.5">
                    {current.outlierRatio.toFixed(1)}× outlier
                  </div>
                  <div className="text-slate-400 text-[11px] truncate">
                    {current.clusterLabel ?? copy.radarUnclusteredLabel}
                    <span className="text-slate-600 mx-1">·</span>
                    {current.contentType === 'shorts' ? copy.radarFormatShorts : copy.radarFormatLongform}
                    <span className="text-slate-600 mx-1">·</span>
                    {current.language?.toUpperCase()}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  )
}

// Bottom-left telemetry overlay: live countdown to the top of the next hour
// (when the hourly-scan cron fires). Re-renders every second.
function NextScanCountdown({ copy }: { copy: CopyKeys }) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  if (!now) return null

  // Time remaining until top of next hour.
  const remainingMs =
    (60 - now.getMinutes()) * 60 * 1000 -
    now.getSeconds() * 1000 -
    now.getMilliseconds()
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return (
    <div className="absolute bottom-8 left-8 z-20 hidden md:block">
      <div className="inline-flex flex-col gap-1 bg-charcoal-900/70 backdrop-blur-md gborder rounded-2xl px-4 py-3 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]">
        <span className="text-slate-500 text-[9px] font-semibold uppercase tracking-[0.22em] whitespace-nowrap">
          {copy.heroNextScanLabel}
        </span>
        <span className="text-slate-100 text-base font-semibold tabular-nums tracking-tight whitespace-nowrap">
          {copy.heroNextScanFormat(minutes, seconds)}
        </span>
      </div>
    </div>
  )
}

// Three strategic detection dots — placed on different ring radii so the
// composition reads as "depth", not as a flat scatter. One bright outer
// (rose), one mid (cyan), one inner (indigo). Slow, distinct rhythms.
const PING_POSITIONS: Array<{
  top: string
  left: string
  size: string
  color: string
  delay: string
  duration: string
  glow: string
}> = [
  { top: '24%', left: '68%', size: 'w-2.5 h-2.5', color: 'bg-rose-400',     delay: '0s',   duration: '3.2s', glow: '0 0 18px rgba(251,113,133,0.9)' },
  { top: '64%', left: '30%', size: 'w-2 h-2',     color: 'bg-glow-cyan',    delay: '1.4s', duration: '3.6s', glow: '0 0 14px rgba(34,211,238,0.85)' },
  { top: '46%', left: '78%', size: 'w-1.5 h-1.5', color: 'bg-glow-indigo',  delay: '2.7s', duration: '3.0s', glow: '0 0 12px rgba(124,131,240,0.85)' },
]

function RadarVisual() {
  return (
    <div className="relative w-[36rem] h-[36rem] sm:w-[44rem] sm:h-[44rem] md:w-[52rem] md:h-[52rem]">
      {/* Concentric rings — slightly brighter than the previous pass so the
          radar reads at 55% opacity without mix-blend tricks. */}
      <div className="absolute inset-0       rounded-full border border-glow-indigo/35" />
      <div className="absolute inset-12      rounded-full border border-glow-indigo/30" />
      <div className="absolute inset-24      rounded-full border border-glow-indigo/24" />
      <div className="absolute inset-[144px] rounded-full border border-glow-indigo/18" />
      <div className="absolute inset-[192px] rounded-full border border-glow-indigo/14" />

      {/* Crosshairs */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-glow-indigo/18 to-transparent" />
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-glow-indigo/18 to-transparent" />

      {/* Sweep arm — narrower trail (40°) and slower duration (8s via inline
          override) so the radar feels deliberate, not anxious. */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full animate-sonar-sweep motion-reduce:animate-none"
        style={{
          background:
            'conic-gradient(from 0deg, rgba(124,131,240,0) 0deg, rgba(124,131,240,0.55) 40deg, rgba(124,131,240,0) 90deg, rgba(124,131,240,0) 360deg)',
          maskImage: 'radial-gradient(circle, black 50%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(circle, black 50%, transparent 100%)',
          animationDuration: '8s',
        }}
      />

      {/* Detection pulse — single concentric ring that emanates from centre
          every 6.5s. The radar "found something." */}
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 w-3 h-3 rounded-full border border-glow-cyan detection-pulse motion-reduce:hidden"
      />

      {/* Three strategic detection dots */}
      {PING_POSITIONS.map((p, i) => (
        <span
          key={`ping-${i}`}
          aria-hidden
          className={`absolute ${p.size} rounded-full ${p.color} animate-ping motion-reduce:animate-none`}
          style={{
            top: p.top,
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            boxShadow: p.glow,
          }}
        />
      ))}

      {/* Center pip */}
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-glow-indigo shadow-[0_0_28px_rgba(124,131,240,0.95)]"
      />
    </div>
  )
}
