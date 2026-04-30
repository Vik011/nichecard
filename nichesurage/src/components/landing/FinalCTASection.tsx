import type { CopyKeys } from './copy'

interface FinalCTASectionProps {
  copy: CopyKeys
}

export function FinalCTASection({ copy }: FinalCTASectionProps) {
  return (
    <section className="py-24 px-6 bg-gradient-to-br from-indigo-900/40 to-violet-900/40">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-8 text-slate-100">
          {copy.ctaHeadline}
        </h2>
        <a
          href="/login"
          className="inline-block py-4 px-8 rounded-xl font-semibold text-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400 transition-all shadow-lg shadow-indigo-900/40"
        >
          {copy.ctaButton}
        </a>
      </div>
    </section>
  )
}
