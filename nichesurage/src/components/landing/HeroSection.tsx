import Link from 'next/link'
import type { CopyKeys } from './copy'

interface HeroSectionProps {
  copy: CopyKeys
}

export function HeroSection({ copy }: HeroSectionProps) {
  return (
    <section className="pt-36 pb-24 px-6 text-center">
      <div className="max-w-3xl mx-auto">
        {/* Live badge */}
        <div className="inline-flex items-center gap-2 bg-green-950/60 border border-green-800/50 rounded-full px-4 py-1.5 mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
          </span>
          <span className="text-green-400 text-sm font-medium">{copy.heroBadge}</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
            {copy.heroHeadline}
          </span>
        </h1>

        {/* Sub */}
        <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          {copy.heroSub}
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="w-full sm:w-auto text-base font-semibold px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all text-white shadow-lg shadow-indigo-900/40"
          >
            {copy.heroCta}
          </Link>
          <a
            href="#pricing"
            className="text-slate-400 hover:text-slate-100 transition-colors text-base"
          >
            {copy.heroCta2}
          </a>
        </div>
      </div>
    </section>
  )
}
