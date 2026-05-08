import { XCircle, CheckCircle } from '@phosphor-icons/react/dist/ssr'
import type { CopyKeys } from './copy'

interface PainSolutionSectionProps {
  copy: CopyKeys
}

/**
 * Before/after comparison: "The slow way" vs "With SurgeNiche".
 *
 * Visual treatment intentionally asymmetric — the left card is
 * de-emphasized (low opacity, slate desaturation, line-through items)
 * to read as an "outdated checklist," while the right card carries
 * full saturation, indigo ring, drop-shadow, and a green pulse next
 * to its title to read as the active/current state.
 *
 * Audit feedback (round 3, 2026-05-06): the prior 50/50 box treatment
 * read as a Google-Docs comparison table — the concept was right but
 * the visual didn't earn the conceptual contrast. The drama now lives
 * in the styling, not just in the copy.
 */
export function PainSolutionSection({ copy }: PainSolutionSectionProps) {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-display text-4xl md:text-5xl font-normal text-center mb-14 text-slate-100 tracking-[-0.01em] text-balance">
          {copy.painHeadline}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-7 items-stretch">
          {/* Left: The slow way — visually demoted to feel "outdated".
              Lower bg saturation, slate-toned title (red bled out),
              slate icons, and line-through text decoration that reads
              like an old completed-then-discarded checklist. */}
          <div
            className="relative gborder bg-charcoal-950/30 rounded-xl p-8 opacity-75 transition-opacity duration-300 hover:opacity-90"
            data-tone="pain"
          >
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-6">
              {copy.painTitle}
            </h3>
            <ul className="space-y-4">
              {copy.painItems.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-500">
                  <XCircle
                    aria-hidden
                    weight="fill"
                    size={18}
                    className="text-red-500/30 mt-0.5 shrink-0"
                  />
                  <span className="leading-relaxed line-through decoration-slate-700/70">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: With SurgeNiche — full saturation, indigo ring,
              drop-shadow that pops the card off the page, and a
              live-status green pulse next to the title to telegraph
              "this is the active state, right now." */}
          <div
            className="relative glass glass-glow rounded-xl p-8 ring-1 ring-glow-indigo/40 shadow-[0_24px_60px_-16px_rgba(16,185,129,0.2)]"
            data-tone="solution"
          >
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-emerald-300 mb-6 flex items-center gap-2.5">
              {copy.solutionTitle}
              <span aria-hidden className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
            </h3>
            <ul className="space-y-4">
              {copy.solutionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-100">
                  <CheckCircle
                    aria-hidden
                    weight="fill"
                    size={18}
                    className="text-emerald-400 mt-0.5 shrink-0"
                  />
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
