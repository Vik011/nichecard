'use client'

// HeroBackdrop layers the live-radar visual behind the hero copy and floats
// the live counter + rotating "channel discovered" toast as overlays. The
// hero text reads on top; the radar gives the section its identity.

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
      {/* Layer 0 — radar dish, centered behind the hero copy. Lives at low
          opacity and gets faded at its edges by a radial gradient mask
          (Layer 1) so the headline reads cleanly. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="opacity-60 mix-blend-screen">
          <RadarVisual />
        </div>
      </div>

      {/* Layer 1 — radial fade so the radar feathers into the page bg
          instead of having a hard circular edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at center, transparent 30%, rgba(6,9,16,0.55) 60%, rgba(6,9,16,0.95) 85%)',
        }}
      />

      {/* Layer 2 — floating live counter, top-right of hero on desktop.
          Hidden on mobile to preserve hero readability. */}
      <div className="hidden md:flex absolute top-8 right-8 z-20 items-center gap-2 bg-charcoal-900/70 backdrop-blur-md gborder rounded-full px-4 py-2">
        <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
        </span>
        <span className="text-emerald-300/95 text-[10px] font-semibold uppercase tracking-[0.22em]">
          {copy.radarLive}
        </span>
        <span className="text-slate-300 text-[12px] font-medium">
          · {copy.radarChannelsLast24h(channelsLast24h)}
        </span>
      </div>

      {/* Layer 3 — floating "channel discovered" notification, bottom-right
          of hero on desktop. Slides in/out as pings rotate. */}
      <div
        className="hidden md:block absolute bottom-8 right-8 z-20 w-[280px] min-h-[96px]"
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

// Stable pseudo-random scatter for the micro-twinkle layer. Stable across
// renders so the staggered animation rhythm doesn't reset.
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

const PING_POSITIONS: Array<{
  top: string
  left: string
  size: string
  color: string
  delay: string
  duration: string
}> = [
  { top: '22%', left: '64%', size: 'w-2 h-2',     color: 'bg-rose-400',     delay: '0s',   duration: '2.2s' },
  { top: '60%', left: '34%', size: 'w-1.5 h-1.5', color: 'bg-rose-400/90',  delay: '0.9s', duration: '2.4s' },
  { top: '40%', left: '82%', size: 'w-1.5 h-1.5', color: 'bg-rose-400',     delay: '1.6s', duration: '2.0s' },
  { top: '76%', left: '60%', size: 'w-1 h-1',     color: 'bg-rose-300/90',  delay: '0.4s', duration: '2.6s' },
  { top: '36%', left: '28%', size: 'w-1.5 h-1.5', color: 'bg-glow-cyan',    delay: '1.1s', duration: '2.3s' },
  { top: '70%', left: '76%', size: 'w-1 h-1',     color: 'bg-glow-cyan/85', delay: '0.6s', duration: '2.1s' },
  { top: '46%', left: '38%', size: 'w-1 h-1',     color: 'bg-glow-indigo',  delay: '1.9s', duration: '2.7s' },
  { top: '54%', left: '64%', size: 'w-1 h-1',     color: 'bg-glow-indigo',  delay: '0.2s', duration: '2.5s' },
  { top: '18%', left: '50%', size: 'w-1 h-1',     color: 'bg-rose-300/70',  delay: '2.0s', duration: '2.8s' },
  { top: '84%', left: '40%', size: 'w-1 h-1',     color: 'bg-rose-300/70',  delay: '1.3s', duration: '2.9s' },
]

function RadarVisual() {
  return (
    <div className="relative w-[36rem] h-[36rem] sm:w-[44rem] sm:h-[44rem] md:w-[52rem] md:h-[52rem]">
      {/* Concentric rings — denser, brighter on the outer edge so the radar
          reads from a distance even at 60% opacity. */}
      <div className="absolute inset-0     rounded-full border border-glow-indigo/30" />
      <div className="absolute inset-12    rounded-full border border-glow-indigo/25" />
      <div className="absolute inset-24    rounded-full border border-glow-indigo/22" />
      <div className="absolute inset-[144px] rounded-full border border-glow-indigo/18" />
      <div className="absolute inset-[192px] rounded-full border border-glow-indigo/14" />

      {/* Crosshairs */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-glow-indigo/15 to-transparent" />
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-glow-indigo/15 to-transparent" />

      {/* Sweep arm */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full animate-sonar-sweep motion-reduce:animate-none"
        style={{
          background:
            'conic-gradient(from 0deg, rgba(124,131,240,0) 0deg, rgba(124,131,240,0.6) 50deg, rgba(124,131,240,0) 110deg, rgba(124,131,240,0) 360deg)',
          maskImage: 'radial-gradient(circle, black 50%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(circle, black 50%, transparent 100%)',
        }}
      />

      {/* Micro-twinkle layer */}
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

      {/* Detection dots */}
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
