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
  /**
   * Retained for type-compat with LandingPage/HeroSection callers; no
   * longer rendered in the backdrop now that the live channel-count
   * lives in the LiveTickerBar above the hero. Marked with `void` below.
   */
  channelsLast24h: number
}

const ROTATION_MS = 3200

export function HeroBackdrop({ copy, pings, channelsLast24h }: HeroBackdropProps) {
  void channelsLast24h
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

      {/* Top-left LIVE chip and bottom-left NextScanCountdown previously
          floated here were hoisted into the LiveTickerBar and the
          HeroStatsBar respectively. Both stats now live in dedicated
          horizontal strips so the corners of the hero stage stay clean
          and the radar visual breathes without competing chips. */}

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
              className="bg-surface-raised/80 backdrop-blur-md gborder rounded-2xl p-4 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.6)]"
            >
              <div className="flex items-start gap-3">
                <div className="relative shrink-0 mt-1.5">
                  <span aria-hidden className="absolute inset-0 -m-1 rounded-full bg-accent-emerald-bright/30 animate-ping" />
                  <span aria-hidden className="relative block w-2 h-2 rounded-full bg-accent-emerald-bright shadow-[0_0_10px_rgba(16,185,129,0.9)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-accent-emerald-bright text-[9px] font-semibold uppercase tracking-[0.22em] mb-1">
                    {copy.radarPingPrefix}
                  </div>
                  <div className="text-ink text-lg font-semibold tracking-tight tabular-nums leading-none mb-1.5">
                    {current.outlierRatio.toFixed(1)}× outlier
                  </div>
                  <div className="text-ink-muted text-[11px] truncate">
                    {current.clusterLabel ?? copy.radarUnclusteredLabel}
                    <span className="text-ink-subtle mx-1">·</span>
                    {current.contentType === 'shorts' ? copy.radarFormatShorts : copy.radarFormatLongform}
                    <span className="text-ink-subtle mx-1">·</span>
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

// (NextScanCountdown was removed when the timer was hoisted into the
//  HeroStatsBar that sits inline at the bottom of the hero copy. The
//  countdown logic lives on as a hook inside HeroStatsBar.tsx.)

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
  { top: '64%', left: '30%', size: 'w-2 h-2',     color: 'bg-accent-emerald-bright',  delay: '1.4s', duration: '3.6s', glow: '0 0 14px rgba(16,185,129,0.85)' },
  { top: '46%', left: '78%', size: 'w-1.5 h-1.5', color: 'bg-accent-emerald-bright',  delay: '2.7s', duration: '3.0s', glow: '0 0 12px rgba(16,185,129,0.85)' },
]

function RadarVisual() {
  return (
    // Sized up the radar dish across breakpoints so the visual reads as
    // a hero atmospheric element rather than a small badge in the middle.
    // The mockup that drove this polish round had the radar dominating
    // the hero's vertical real estate; matching that intensity here.
    <div className="relative w-[42rem] h-[42rem] sm:w-[52rem] sm:h-[52rem] md:w-[64rem] md:h-[64rem] lg:w-[72rem] lg:h-[72rem]">
      {/* Concentric rings — slightly brighter than the previous pass so the
          radar reads at 55% opacity without mix-blend tricks. */}
      <div className="absolute inset-0       rounded-full border border-hairline-edge/35" />
      <div className="absolute inset-12      rounded-full border border-hairline-edge/30" />
      <div className="absolute inset-24      rounded-full border border-hairline-edge/24" />
      <div className="absolute inset-[144px] rounded-full border border-hairline-edge/18" />
      <div className="absolute inset-[192px] rounded-full border border-hairline-edge/14" />

      {/* Crosshairs */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-600/18 to-transparent" />
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-slate-600/18 to-transparent" />

      {/* Sweep arm — narrower trail (40°) and slower duration (8s via inline
          override) so the radar feels deliberate, not anxious. */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full animate-sonar-sweep motion-reduce:animate-none"
        style={{
          background:
            'conic-gradient(from 0deg, rgba(148,163,184,0) 0deg, rgba(148,163,184,0.45) 40deg, rgba(148,163,184,0) 90deg, rgba(148,163,184,0) 360deg)',
          maskImage: 'radial-gradient(circle, black 50%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(circle, black 50%, transparent 100%)',
          animationDuration: '8s',
        }}
      />

      {/* Detection pulse — single concentric ring that emanates from centre
          every 6.5s. The radar "found something." */}
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 w-3 h-3 rounded-full border border-accent-emerald-bright detection-pulse motion-reduce:hidden"
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
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-accent-emerald-bright shadow-[0_0_28px_rgba(16,185,129,0.95)]"
      />
    </div>
  )
}
