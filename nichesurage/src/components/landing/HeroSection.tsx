import Link from 'next/link'
import type { CopyKeys } from './copy'
import type { RadarSnapshot } from '@/lib/landing/fetchRadarPings'
import { HeroBackdrop } from './HeroBackdrop'

interface HeroSectionProps {
  copy: CopyKeys
  isLoggedIn?: boolean
  radar: RadarSnapshot
}

export function HeroSection({ copy, isLoggedIn = false, radar }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden pt-32 pb-28 px-6 text-center min-h-[78vh]">
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
      <div className="relative z-10 max-w-2xl mx-auto w-full flex flex-col items-center">
        {/* Eyebrow — product positioning above the narrative headline. */}
        <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-glow-indigo mb-5">
          {copy.heroEyebrow}
        </span>

        {/* Live "47 channels spiked" badge */}
        <div
          role="status"
          aria-label={copy.heroBadge}
          className="inline-flex items-center gap-2 bg-charcoal-900/70 backdrop-blur-md gborder rounded-full px-4 py-1.5 mb-7"
        >
          <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span aria-hidden="true" className="text-emerald-300/90 text-[13px] font-medium tracking-tight">
            {copy.heroBadge}
          </span>
        </div>

        {/* Headline — narrative voice, sized down from 64 → 52 so the sub
            (which carries the actual product value) gets its share of weight. */}
        <h1 className="text-3xl sm:text-4xl md:text-[52px] font-medium tracking-[-0.02em] leading-[1.08] text-slate-100 text-balance mb-5 drop-shadow-[0_2px_24px_rgba(6,9,16,0.85)]">
          {copy.heroHeadline}
        </h1>

        {/* Sub — value prop. Bumped to 20px, slate-300 for stronger contrast,
            tightened max-width so reading rhythm is predictable. */}
        <p className="text-[17px] sm:text-[20px] text-slate-300 mb-10 max-w-xl mx-auto leading-[1.55] text-balance">
          {copy.heroSub}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
          <Link
            href={isLoggedIn ? '/discover/shorts' : '/login'}
            className="w-full sm:w-auto text-[15px] font-semibold px-7 py-3 rounded-xl
                       bg-gradient-to-br from-brand-indigo to-brand-indigo-bright
                       hover:brightness-110 hover:shadow-glow-cyan transition-all text-white
                       shadow-[0_8px_24px_-6px_rgba(124,131,240,0.45)]"
          >
            {isLoggedIn ? copy.navOpenApp : copy.heroCta}
          </Link>
          <a
            href="#how"
            className="text-slate-400 hover:text-slate-200 transition-colors text-[15px]"
          >
            {copy.heroCta2}
          </a>
        </div>
      </div>
    </section>
  )
}
