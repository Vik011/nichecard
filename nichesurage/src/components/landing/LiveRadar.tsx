'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CopyKeys } from './copy'
import type { RadarPing } from '@/lib/landing/fetchRadarPings'

interface LiveRadarProps {
  copy: CopyKeys
  pings: RadarPing[]
  channelsLast24h: number
}

const ROTATION_MS = 2800

export function LiveRadar({ copy, pings, channelsLast24h }: LiveRadarProps) {
  const [index, setIndex] = useState(0)

  // Rotate through pings on a fixed interval. If reduced-motion is requested
  // we still loop, but slow the cadence so the toast isn't flickery.
  useEffect(() => {
    if (pings.length === 0) return
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const ms = reduced ? ROTATION_MS * 2 : ROTATION_MS
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % pings.length)
    }, ms)
    return () => window.clearInterval(t)
  }, [pings.length])

  const current = pings[index]

  return (
    <section className="pt-2 pb-16 px-6">
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-8">
        <RadarVisual />

        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="text-emerald-300/90 text-[12px] font-semibold uppercase tracking-[0.18em]">
            {copy.radarLive}
          </span>
          <span className="text-slate-400 text-sm font-medium">
            · {copy.radarChannelsLast24h(channelsLast24h)}
          </span>
        </div>

        <div className="min-h-[88px] text-center" aria-live="polite" aria-atomic="true">
          <AnimatePresence mode="wait">
            {current ? (
              <motion.div
                key={current.id + ':' + index}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="flex flex-col gap-1.5 items-center"
              >
                <span className="text-glow-cyan text-[10px] font-semibold uppercase tracking-[0.22em]">
                  {copy.radarPingPrefix}
                </span>
                <span className="text-slate-100 text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums">
                  {current.outlierRatio.toFixed(1)}× outlier
                </span>
                <span className="text-slate-400 text-sm">
                  {current.clusterLabel ?? copy.radarUnclusteredLabel}
                  <span className="text-slate-600 mx-1.5">·</span>
                  {current.contentType === 'shorts' ? copy.radarFormatShorts : copy.radarFormatLongform}
                  <span className="text-slate-600 mx-1.5">·</span>
                  {current.language?.toUpperCase()}
                </span>
              </motion.div>
            ) : (
              <span className="text-slate-500 text-sm">{copy.radarSubline}</span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

// Stable pseudo-random scattered positions for the micro-twinkle layer.
// These need to be stable across renders or React will re-create the spans
// and the staggered animation-delay rhythm collapses. Keep them in a const.
const TWINKLE_POSITIONS: Array<{ top: string; left: string; delay: string; duration: string }> = [
  { top: '14%', left: '38%', delay: '0s',   duration: '3.1s' },
  { top: '20%', left: '70%', delay: '1.4s', duration: '3.6s' },
  { top: '32%', left: '22%', delay: '0.7s', duration: '2.8s' },
  { top: '50%', left: '12%', delay: '2.2s', duration: '3.3s' },
  { top: '58%', left: '88%', delay: '0.3s', duration: '3.0s' },
  { top: '74%', left: '24%', delay: '1.8s', duration: '3.5s' },
  { top: '82%', left: '54%', delay: '0.9s', duration: '2.9s' },
  { top: '88%', left: '78%', delay: '2.6s', duration: '3.4s' },
]

const PING_POSITIONS: Array<{ top: string; left: string; size: string; color: string; delay: string; duration: string }> = [
  // Strong outer detections — rose pulses
  { top: '24%', left: '64%', size: 'w-2 h-2',     color: 'bg-rose-400',     delay: '0s',   duration: '2.2s' },
  { top: '60%', left: '34%', size: 'w-1.5 h-1.5', color: 'bg-rose-400/90',  delay: '0.9s', duration: '2.4s' },
  { top: '40%', left: '82%', size: 'w-1.5 h-1.5', color: 'bg-rose-400',     delay: '1.6s', duration: '2.0s' },
  { top: '76%', left: '60%', size: 'w-1 h-1',     color: 'bg-rose-300/90',  delay: '0.4s', duration: '2.6s' },
  // Cyan secondary detections — different rhythm
  { top: '36%', left: '28%', size: 'w-1.5 h-1.5', color: 'bg-glow-cyan',    delay: '1.1s', duration: '2.3s' },
  { top: '70%', left: '76%', size: 'w-1 h-1',     color: 'bg-glow-cyan/85', delay: '0.6s', duration: '2.1s' },
  // Inner ring — indigo accents
  { top: '46%', left: '38%', size: 'w-1 h-1',     color: 'bg-glow-indigo',  delay: '1.9s', duration: '2.7s' },
  { top: '54%', left: '64%', size: 'w-1 h-1',     color: 'bg-glow-indigo',  delay: '0.2s', duration: '2.5s' },
  // Edge faint detections
  { top: '18%', left: '50%', size: 'w-1 h-1',     color: 'bg-rose-300/70',  delay: '2.0s', duration: '2.8s' },
  { top: '84%', left: '40%', size: 'w-1 h-1',     color: 'bg-rose-300/70',  delay: '1.3s', duration: '2.9s' },
]

function RadarVisual() {
  return (
    <div className="relative w-72 h-72 sm:w-[22rem] sm:h-[22rem] md:w-[26rem] md:h-[26rem]">
      {/* Concentric rings (5 of them — denser feels more "sensor grid") */}
      <div className="absolute inset-0   rounded-full border border-glow-indigo/25" />
      <div className="absolute inset-6   rounded-full border border-glow-indigo/22" />
      <div className="absolute inset-12  rounded-full border border-glow-indigo/18" />
      <div className="absolute inset-[72px] rounded-full border border-glow-indigo/14" />
      <div className="absolute inset-[96px] rounded-full border border-glow-indigo/10" />

      {/* Crosshairs */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-glow-indigo/15 to-transparent" />
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-glow-indigo/15 to-transparent" />

      {/* Sweep arm */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full animate-sonar-sweep motion-reduce:animate-none"
        style={{
          background:
            'conic-gradient(from 0deg, rgba(124,131,240,0) 0deg, rgba(124,131,240,0.5) 50deg, rgba(124,131,240,0) 110deg, rgba(124,131,240,0) 360deg)',
          maskImage: 'radial-gradient(circle, black 50%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(circle, black 50%, transparent 100%)',
        }}
      />

      {/* Micro-twinkle layer — tiny background dots that fade in/out
          constantly so the radar never feels static. Below the ping detections
          in z-order. */}
      {TWINKLE_POSITIONS.map((p, i) => (
        <span
          key={`twinkle-${i}`}
          aria-hidden
          className="absolute w-px h-px rounded-full bg-glow-indigo/60 animate-pulse motion-reduce:animate-none"
          style={{
            top: p.top,
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}

      {/* Detection dots — pulse in red/cyan/indigo, varied delays + durations
          so the radar reads as constantly busy. Decorative; the textual feed
          below is the source of truth. */}
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
            boxShadow:
              p.color.includes('rose')
                ? '0 0 12px rgba(251,113,133,0.85)'
                : p.color.includes('cyan')
                ? '0 0 10px rgba(34,211,238,0.7)'
                : '0 0 10px rgba(124,131,240,0.7)',
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
