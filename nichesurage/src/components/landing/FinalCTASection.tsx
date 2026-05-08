import type { CopyKeys } from './copy'

interface FinalCTASectionProps {
  copy: CopyKeys
  isLoggedIn?: boolean
}

/**
 * Closing CTA — the page conclusion, not an afterthought.
 *
 * Audit feedback (round 3, 2026-05-06): the prior single-radial-gradient
 * backdrop (0.10 alpha) left the headline + button floating in empty
 * space. The audit said: "Dodaj suptilni background — radijalni glow
 * u boji accenta, ili vrati radar element iz hero-a u minijaturi iza
 * toga. Treba da se oseti kao zaključak."
 *
 * This rewrite stacks four atmospheric layers behind the content:
 *   1. Primary indigo radial glow (0.10 → 0.20 alpha) for visual gravity
 *   2. Secondary cyan accent glow, offset slightly for compositional depth
 *   3. Static concentric rings — a quiet rhyme with the hero radar (no
 *      sweep arm, no detection pulse, so it reads as a frame, not a
 *      second competing center of motion)
 *   4. Tiny center pip with indigo glow — a "target-locked" full-stop
 *      under the headline
 *
 * All decorative; aria-hidden. Turns "here's a button" into "this is
 * the conclusion."
 */
export function FinalCTASection({ copy, isLoggedIn = false }: FinalCTASectionProps) {
  return (
    <section className="relative py-28 px-6 overflow-hidden">
      {/* Layered atmospheric backdrop. */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        {/* Primary indigo radial glow — visual gravity. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at center, rgba(124,131,240,0.20), transparent 65%)',
          }}
        />
        {/* Secondary cyan accent — offset lower for compositional depth. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 50% 40% at 50% 65%, rgba(34,211,238,0.08), transparent 60%)',
          }}
        />
        {/* Concentric rings — quiet rhyme with the hero radar. */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-[28rem] h-[28rem] sm:w-[36rem] sm:h-[36rem] md:w-[44rem] md:h-[44rem] opacity-60">
            <div className="absolute inset-0 rounded-full border border-slate-700/20" />
            <div className="absolute inset-12 rounded-full border border-slate-700/14" />
            <div className="absolute inset-24 rounded-full border border-slate-700/8" />
            {/* Center pip — "target-locked" full-stop. */}
            <span
              aria-hidden
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400/70 shadow-[0_0_18px_rgba(16,185,129,0.6)]"
            />
          </div>
        </div>
      </div>

      <div className="relative max-w-3xl mx-auto text-center">
        <h2 className="font-display text-4xl md:text-6xl font-normal tracking-[-0.01em] text-slate-100 mb-8 text-balance">
          {copy.ctaHeadline}
        </h2>
        <a
          href={isLoggedIn ? '/discover' : '/login'}
          className="inline-block px-8 py-3.5 rounded-xl bg-white text-charcoal-900 font-semibold shadow-[0_10px_30px_-8px_rgba(0,0,0,0.25)] hover:bg-slate-100 hover:shadow-[0_14px_36px_-8px_rgba(0,0,0,0.3)] transition-all"
        >
          {isLoggedIn ? copy.navOpenApp : copy.ctaButton}
        </a>
      </div>
    </section>
  )
}
