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
  // we still loop, but we slow the cadence so the toast isn't flickery.
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
    <section className="py-12 sm:py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="gborder bg-charcoal-900/40 rounded-3xl p-8 sm:p-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
            {/* Left: radar visual */}
            <div className="flex justify-center">
              <RadarVisual />
            </div>

            {/* Right: live counter + rotating ping toast */}
            <div className="flex flex-col gap-6 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2">
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

              <div className="min-h-[88px]" aria-live="polite" aria-atomic="true">
                <AnimatePresence mode="wait">
                  {current ? (
                    <motion.div
                      key={current.id + ':' + index}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className="flex flex-col gap-1.5"
                    >
                      <span className="text-glow-cyan text-[10px] font-semibold uppercase tracking-[0.22em]">
                        {copy.radarPingPrefix}
                      </span>
                      <span className="text-slate-100 text-xl sm:text-2xl font-semibold tracking-tight tabular-nums">
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
                    <div className="flex flex-col gap-1.5">
                      <span className="text-slate-500 text-sm">
                        {copy.radarSubline}
                      </span>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function RadarVisual() {
  return (
    <div className="relative w-56 h-56 sm:w-64 sm:h-64">
      {/* Concentric rings */}
      <div className="absolute inset-0 rounded-full border border-glow-indigo/25" />
      <div className="absolute inset-6 rounded-full border border-glow-indigo/20" />
      <div className="absolute inset-12 rounded-full border border-glow-indigo/15" />
      <div className="absolute inset-[72px] rounded-full border border-glow-indigo/10" />

      {/* Crosshairs */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-glow-indigo/15 to-transparent" />
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-glow-indigo/15 to-transparent" />

      {/* Sweep arm via conic-gradient mask */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full animate-sonar-sweep motion-reduce:animate-none"
        style={{
          background:
            'conic-gradient(from 0deg, rgba(124,131,240,0) 0deg, rgba(124,131,240,0.45) 60deg, rgba(124,131,240,0) 120deg, rgba(124,131,240,0) 360deg)',
          maskImage: 'radial-gradient(circle, black 50%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(circle, black 50%, transparent 100%)',
        }}
      />

      {/* Detection dots — pulse on staggered intervals to feel like the radar
          is actively flagging things. Decorative; the textual feed is the
          source of truth. */}
      <span
        aria-hidden
        className="absolute top-[26%] left-[62%] w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.9)] animate-ping motion-reduce:animate-none"
        style={{ animationDelay: '0s', animationDuration: '2.2s' }}
      />
      <span
        aria-hidden
        className="absolute top-[60%] left-[36%] w-1.5 h-1.5 rounded-full bg-rose-400/90 shadow-[0_0_10px_rgba(251,113,133,0.8)] animate-ping motion-reduce:animate-none"
        style={{ animationDelay: '0.9s', animationDuration: '2.4s' }}
      />
      <span
        aria-hidden
        className="absolute top-[44%] left-[78%] w-1.5 h-1.5 rounded-full bg-glow-cyan animate-ping motion-reduce:animate-none"
        style={{ animationDelay: '1.6s', animationDuration: '2.0s' }}
      />
      <span
        aria-hidden
        className="absolute top-[72%] left-[58%] w-1 h-1 rounded-full bg-rose-300/90 animate-ping motion-reduce:animate-none"
        style={{ animationDelay: '0.4s', animationDuration: '2.6s' }}
      />
      <span
        aria-hidden
        className="absolute top-[36%] left-[28%] w-1 h-1 rounded-full bg-glow-indigo/90 animate-ping motion-reduce:animate-none"
        style={{ animationDelay: '1.2s', animationDuration: '2.3s' }}
      />

      {/* Center pip with stronger glow — anchors the composition */}
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-glow-indigo shadow-[0_0_24px_rgba(124,131,240,0.9)]"
      />
    </div>
  )
}
