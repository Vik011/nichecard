import type { CopyKeys } from './copy'

interface PainSolutionSectionProps {
  copy: CopyKeys
}

export function PainSolutionSection({ copy }: PainSolutionSectionProps) {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-slate-100">
          {copy.painHeadline}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: The old way */}
          <div className="bg-slate-900 border border-red-900/40 rounded-xl p-8">
            <h3 className="text-lg font-semibold text-red-400 mb-6">{copy.painTitle}</h3>
            <ul className="space-y-4">
              {copy.painItems.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-400">
                  <span aria-hidden="true" className="text-red-500 mt-0.5 shrink-0">✕</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Right: With NicheSurge */}
          <div className="bg-slate-900 border border-indigo-800/50 rounded-xl p-8">
            <h3 className="text-lg font-semibold text-indigo-400 mb-6">{copy.solutionTitle}</h3>
            <ul className="space-y-4">
              {copy.solutionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-100">
                  <span aria-hidden="true" className="text-green-400 mt-0.5 shrink-0">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
