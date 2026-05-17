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
      // mt-16 (= h-16, same as LandingNav height) pushes the ticker
      // BELOW the fixed nav. Without it, the nav (position:fixed) takes
      // no vertical space in flow and the ticker renders at top:0,
      // overlapping the logo and clipping behind the right-side controls.
      className="mt-16 border-b border-hairline-soft bg-surface-raised/30 backdrop-blur-md"
    >
      <div className="max-w-6xl mx-auto px-6 py-2 flex items-center justify-center gap-3 sm:gap-5 text-[12px] sm:text-[13px]">
        {/* LIVE pulse + label */}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-emerald/30 bg-accent-emerald/10 px-2.5 py-0.5">
          <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-emerald-bright opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-emerald-bright" />
          </span>
          <span className="text-accent-emerald-bright/95 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em]">
            {copy.tickerLive}
          </span>
        </span>

        {/* Stat 1: spiked last hour */}
        <span className="text-ink-muted whitespace-nowrap">
          {copy.tickerSpikedLastHour(spikedLastHour)}
        </span>

        {/* Separator + Stat 2 hidden on small screens to avoid wrap */}
        <span aria-hidden className="text-ink-subtle hidden sm:inline">·</span>
        <span className="text-ink-muted whitespace-nowrap hidden sm:inline">
          {copy.tickerNichesToday(nichesSurfacedToday)}
        </span>
      </div>
    </div>
  )
}
