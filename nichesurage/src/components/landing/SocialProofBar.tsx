import type { CopyKeys } from './copy'

interface SocialProofBarProps {
  copy: CopyKeys
}

export function SocialProofBar({ copy }: SocialProofBarProps) {
  const stats = [copy.socialTrust, copy.socialNiches, copy.socialViews]

  return (
    <section className="py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="gborder bg-charcoal-900/40 rounded-2xl py-5 px-8 flex flex-wrap justify-center gap-8 md:gap-16">
          {stats.map((stat) => (
            <span key={stat} className="text-slate-400 text-sm font-medium tracking-tight">
              {stat}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
