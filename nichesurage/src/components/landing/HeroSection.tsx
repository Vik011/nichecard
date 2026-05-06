import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import type { CopyKeys } from './copy'
import type { RadarSnapshot } from '@/lib/landing/fetchRadarPings'
import { HeroBackdrop } from './HeroBackdrop'
import { HeroStatsBar } from './HeroStatsBar'

interface HeroSectionProps {
  copy: CopyKeys
  isLoggedIn?: boolean
  radar: RadarSnapshot
}

export function HeroSection({ copy, isLoggedIn = false, radar }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden pt-16 pb-28 px-6 text-center min-h-[78vh]">
      <HeroBackdrop copy={copy} pings={radar.pings} channelsLast24h={radar.channelsLast24h} />

      {/* Bottom fade — softens the radar's hard edge into the next section
          so the page reads as one continuous canvas. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 z-[5]"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, rgba(6,9,16,1) 100%)',
        }}
      />

      {/* Note: deliberately NOT using `flex items-center` on <section>. With
          flex centering, even absolutely-positioned chips inside HeroBackdrop
          ended up vertically centered alongside the hero copy. Plain block
          layout + pt/pb gives the absolute corners their actual top/bottom
          anchors back. */}
      <div className="relative z-10 max-w-3xl mx-auto w-full flex flex-col items-center">
        {/* Green pulse pill — present-tense action ("scanning right
            now") that complements the LiveTickerBar above (which
            carries backward-looking stats). Sets the atmospheric
            register before the H1 lands. */}
        <div
          role="status"
          aria-label={copy.heroPulse}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 mb-6"
        >
          <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span aria-hidden="true" className="text-emerald-300/95 text-[11px] font-semibold uppercase tracking-[0.2em]">
            {copy.heroPulse}
          </span>
        </div>

        {/* SEO-anchored H1, split into two visual lines: regular weight
            on the keyword phrase, italic on the action verb. The split
            gives the H1 typographic momentum and matches an editorial
            section-header cadence (vs a flat single-line banner). */}
        <h1 className="font-display tracking-[-0.02em] text-slate-100 text-balance mb-5 drop-shadow-[0_2px_24px_rgba(6,9,16,0.85)]">
          <span className="block text-[44px] sm:text-[58px] md:text-[72px] font-normal leading-[1.02]">
            {copy.heroHeadlineMain}
          </span>
          <span className="block italic font-normal text-[40px] sm:text-[52px] md:text-[68px] leading-[1.02] text-slate-200">
            {copy.heroHeadlineEmphasis}
          </span>
        </h1>

        {/* Founder narrative as italic tagline directly under the H1.
            Bumped up from slate-400 to slate-300 for stronger contrast
            (audit P1 a11y fix; italic serif on dark was borderline). */}
        <p className="font-display italic text-[17px] sm:text-[19px] text-slate-300 mb-7 max-w-md mx-auto leading-[1.45] text-balance">
          {copy.heroNarrative}
        </p>

        {/* Sub paragraph — value prop. slate-300 → slate-200 for WCAG
            AA-compliant body text on dark background (audit P0). Bold
            strong on the value-prop fragment anchors the eye on the
            differentiator ("the small accounts that started moving"). */}
        <p className="text-[16px] sm:text-[18px] text-slate-200 mb-9 max-w-xl mx-auto leading-[1.55] text-balance">
          {copy.heroSubLeading}{' '}
          <strong className="font-semibold text-white">
            {copy.heroSubBold}
          </strong>
          {copy.heroSubTrailing}
        </p>

        {/* Matched CTA pair — both as ghost outlined buttons sharing
            border, radius, padding, type-size. Mockup-driven. The
            previous "primary gradient + secondary text link" layout
            read as mismatched: visually the pair didn't telegraph
            "two routes forward from here" (one to start using the app,
            one to learn how it works). The new pair does. The arrow on
            "Open app" is the only differentiator and is enough. */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={isLoggedIn ? '/discover' : '/login'}
            className={[
              'group inline-flex items-center gap-2 w-full sm:w-auto justify-center',
              'text-[15px] font-semibold px-6 py-3 rounded-xl',
              'border border-slate-700 bg-charcoal-900/40 backdrop-blur-sm text-slate-100',
              'transition-colors duration-200 ease-out',
              'hover:border-glow-indigo/60 hover:bg-charcoal-800/60 hover:text-white',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow-indigo/60 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon-950',
            ].join(' ')}
          >
            <span>{isLoggedIn ? copy.navOpenApp : copy.heroCta}</span>
            <ArrowRight
              size={16}
              weight="bold"
              aria-hidden
              className="transition-transform duration-200 ease-out group-hover:translate-x-0.5"
            />
          </Link>
          <a
            href="#how"
            className={[
              'inline-flex items-center w-full sm:w-auto justify-center',
              'text-[15px] font-semibold px-6 py-3 rounded-xl',
              'border border-slate-700 bg-charcoal-900/40 backdrop-blur-sm text-slate-100',
              'transition-colors duration-200 ease-out',
              'hover:border-glow-indigo/60 hover:bg-charcoal-800/60 hover:text-white',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow-indigo/60 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon-950',
            ].join(' ')}
          >
            {copy.heroCta2}
          </a>
        </div>

        {/* Bottom-of-hero stats strip. Anchors the visual rhythm: scan
            cadence on the left, live progress + spike count in the
            center, scan interval on the right. Replaces the orphan
            NextScanCountdown chip that lived in the bottom-left corner
            of HeroBackdrop. */}
        <HeroStatsBar copy={copy} spikingNow={47} />
      </div>
    </section>
  )
}
