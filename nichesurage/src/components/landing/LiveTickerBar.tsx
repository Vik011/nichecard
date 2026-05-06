import type { CopyKeys } from './copy'

interface LiveTickerBarProps {
  copy: CopyKeys
  spikedLastHour: number
  nichesSurfacedToday: number
}

/**
 * Full-width live activity strip below the LandingNav. Replaces the
 * standalone top-left LIVE chip + bottom-left timer that previously
 * floated in opposite corners of the hero, by promoting two real-time
 * stats into a single horizontal row directly under the nav. Stronger
 * "this is alive" signal because the eye reads the data in one glance,
 * not after parsing two separate floating chips.
 *
 * Visual treatment is minimal — thin strip, subtle bottom border, no
 * background fill — so it reads as system telemetry rather than a
 * marketing band. Sticky positioning is intentionally NOT applied:
 * the strip is pinned visually below the nav at page top but scrolls
 * naturally as part of the page so it doesn't compete for vertical
 * real estate further down.
 */
export function LiveTickerBar({
  copy,
  spikedLastHour,
  nichesSurfacedToday,
}: LiveTickerBarProps) {
  return (
    <div
      role="status"
      aria-label={`Live activity: ${copy.tickerSpikedLastHour(spikedLastHour)}, ${copy.tickerNichesToday(nichesSurfacedToday)}`}
      className="border-b border-white/[0.05] bg-charcoal-900/30 backdrop-blur-md"
    >
      <div className="max-w-6xl mx-auto px-6 py-2 flex items-center justify-center gap-3 sm:gap-5 text-[12px] sm:text-[13px]">
        {/* LIVE pulse + label */}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5">
          <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="text-emerald-300/95 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em]">
            {copy.tickerLive}
          </span>
        </span>

        {/* Stat 1: spiked last hour */}
        <span className="text-slate-300 whitespace-nowrap">
          {copy.tickerSpikedLastHour(spikedLastHour)}
        </span>

        {/* Separator + Stat 2 hidden on small screens to avoid wrap */}
        <span aria-hidden className="text-slate-600 hidden sm:inline">·</span>
        <span className="text-slate-400 whitespace-nowrap hidden sm:inline">
          {copy.tickerNichesToday(nichesSurfacedToday)}
        </span>
      </div>
    </div>
  )
}
