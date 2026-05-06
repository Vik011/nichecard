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
        {/* Live "47 channels spiked" badge promoted to first element —
            the eyebrow used to sit above this and read as a duplicate
            of the page title metadata. The badge alone is the strongest
            "this is alive" signal a hero can carry. */}
        <div
          role="status"
          aria-label={copy.heroBadge}
          className="inline-flex items-center gap-2 bg-charcoal-900/70 backdrop-blur-md gborder rounded-full px-4 py-1.5 mb-8"
        >
          <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span aria-hidden="true" className="text-emerald-300/90 text-[13px] font-medium tracking-tight">
            {copy.heroBadge}
          </span>
        </div>

        {/* SEO-anchored H1. Display serif (Instrument Serif via
            font-display) gives editorial character that contrasts the
            sans body and signals "this was authored by a human, not a
            template". Sized larger than before (52→60) since it's now
            doing both the SEO and the visual-hook job. text-balance
            avoids ragged 2-word last lines. */}
        <h1 className="font-display text-[40px] sm:text-[52px] md:text-[64px] font-normal tracking-[-0.02em] leading-[1.04] text-slate-100 text-balance mb-5 drop-shadow-[0_2px_24px_rgba(6,9,16,0.85)]">
          {copy.heroHeadline}
        </h1>

        {/* Founder narrative kept as italic tagline directly under the
            H1 — preserves the "personally crafted" voice while letting
            the SEO H1 do its job. Italic + slate-400 keeps it
            subordinate visually. */}
        <p className="font-display italic text-[17px] sm:text-[19px] text-slate-400 mb-7 max-w-md mx-auto leading-[1.45] text-balance">
          {copy.heroNarrative}
        </p>

        {/* Sub — sans body, value-prop. Sits below the narrative as the
            "what it actually does" paragraph. */}
        <p className="text-[16px] sm:text-[18px] text-slate-300 mb-9 max-w-xl mx-auto leading-[1.55] text-balance">
          {copy.heroSub}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
          <Link
            // Unified Discover surface — go straight to /discover instead
            // of /discover/shorts (which is now a redirect). Skips a
            // round-trip and matches the new top nav structure.
            href={isLoggedIn ? '/discover' : '/login'}
            className={[
              'w-full sm:w-auto text-[15px] font-semibold px-7 py-3 rounded-xl text-white',
              'bg-gradient-to-br from-brand-indigo to-brand-indigo-bright',
              'shadow-[0_8px_24px_-6px_rgba(124,131,240,0.45)]',
              'transition-[transform,box-shadow,filter] duration-200 ease-out',
              'hover:-translate-y-[1px] hover:brightness-[1.08] hover:shadow-[0_12px_32px_-8px_rgba(124,131,240,0.6)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow-indigo/60 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon-950',
            ].join(' ')}
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
