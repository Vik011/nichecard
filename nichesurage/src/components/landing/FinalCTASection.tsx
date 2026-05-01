import type { CopyKeys } from './copy'

interface FinalCTASectionProps {
  copy: CopyKeys
  isLoggedIn?: boolean
}

export function FinalCTASection({ copy, isLoggedIn = false }: FinalCTASectionProps) {
  return (
    <section className="relative py-28 px-6 overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(124,131,240,0.10),_transparent_60%)]"
      />
      <div className="relative max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-slate-100 mb-8 text-balance">
          {copy.ctaHeadline}
        </h2>
        <a
          href={isLoggedIn ? '/discover/shorts' : '/login'}
          className="inline-block px-8 py-3.5 rounded-xl bg-gradient-to-br from-glow-indigo to-glow-violet text-white font-semibold shadow-[0_10px_30px_-8px_rgba(124,131,240,0.5)] hover:brightness-110 transition-all"
        >
          {isLoggedIn ? copy.navOpenApp : copy.ctaButton}
        </a>
      </div>
    </section>
  )
}
