import type { CopyKeys } from './copy'

interface PainSolutionSectionProps {
  copy: CopyKeys
}

export function PainSolutionSection({ copy }: PainSolutionSectionProps) {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-semibold text-center mb-14 text-slate-100 tracking-tight text-balance">
          {copy.painHeadline}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left: The slow way */}
          <div className="relative gborder bg-charcoal-900 rounded-xl p-8" data-tone="pain">
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-red-400/90 mb-6">
              {copy.painTitle}
            </h3>
            <ul className="space-y-4">
              {copy.painItems.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-400">
                  <span aria-hidden="true" className="text-red-500/80 mt-0.5 shrink-0">✕</span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Right: With SurgeNiche */}
          <div className="relative glass glass-glow rounded-xl p-8 border-indigo-800/0">
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-glow-indigo mb-6">
              {copy.solutionTitle}
            </h3>
            <ul className="space-y-4">
              {copy.solutionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-100">
                  <span aria-hidden="true" className="text-emerald-400/90 mt-0.5 shrink-0">✓</span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
