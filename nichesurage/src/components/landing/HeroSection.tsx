import Link from 'next/link'
import type { CopyKeys } from './copy'

interface HeroSectionProps {
  copy: CopyKeys
  isLoggedIn?: boolean
}

export function HeroSection({ copy, isLoggedIn = false }: HeroSectionProps) {
  return (
    <section className="relative pt-36 pb-24 px-6 text-center">
      <div className="max-w-3xl mx-auto">
        <div
          role="status"
          aria-label={copy.heroBadge}
          className="inline-flex items-center gap-2 bg-charcoal-900/70 gborder rounded-full px-4 py-1.5 mb-10"
        >
          <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span aria-hidden="true" className="text-emerald-300/90 text-[13px] font-medium tracking-tight">
            {copy.heroBadge}
          </span>
        </div>

        <h1 className="text-5xl md:text-[64px] font-semibold tracking-[-0.02em] leading-[1.05] mb-7 text-slate-100 text-balance">
          {copy.heroHeadline}
        </h1>

        <p className="text-[18px] text-slate-400 mb-11 max-w-2xl mx-auto leading-relaxed text-balance">
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
