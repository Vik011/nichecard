import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Robot, Clock, Flame, TrendUp, Lightbulb, BellSimple, Heartbeat } from '@phosphor-icons/react/dist/ssr'
import type { CopyKeys } from './copy'

interface FeaturesSectionProps {
  copy: CopyKeys
}

const ICON_MAP: Record<string, PhosphorIcon> = {
  bot: Robot,
  clock: Clock,
  flame: Flame,
  'trend-up': TrendUp,
  lightbulb: Lightbulb,
  bell: BellSimple,
  heartbeat: Heartbeat,
}

export function FeaturesSection({ copy }: FeaturesSectionProps) {
  return (
    <section id="how" className="py-24 px-6 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-semibold text-center mb-14 text-slate-100 tracking-tight">
          {copy.featuresTitle}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {copy.features.map((feature) => {
            const Icon = ICON_MAP[feature.icon]
            const isPremium = feature.tier === 'premium'
            const status = 'status' in feature ? feature.status : undefined
            return (
              <div
                key={feature.title}
                className={`relative rounded-xl p-6 bg-charcoal-900 ${isPremium ? 'glass glass-violet' : 'gborder'}`}
              >
                {isPremium && (
                  <span
                    data-testid={`feature-premium-badge-${feature.icon}`}
                    className="absolute top-4 right-4 text-[10px] font-semibold tracking-[0.18em] text-glow-violet uppercase"
                  >
                    {copy.featuresPremiumBadge}
                  </span>
                )}
                {Icon && (
                  <Icon
                    weight="duotone"
                    size={30}
                    aria-hidden="true"
                    data-testid={`feature-icon-${feature.icon}`}
                    className={isPremium ? 'text-glow-violet mb-5' : 'text-glow-indigo mb-5'}
                  />
                )}
                <h3 className="text-slate-100 font-semibold mb-2 text-[15px]">{feature.title}</h3>
                {status && (
                  <span
                    data-testid={`feature-status-${feature.icon}`}
                    className={
                      status === 'live'
                        ? 'inline-block mb-3 text-[10px] font-semibold tracking-[0.18em] text-emerald-300 uppercase'
                        : 'inline-block mb-3 text-[10px] font-semibold tracking-[0.18em] text-slate-500 uppercase'
                    }
                  >
                    {status === 'live' ? copy.featuresStatusLive : copy.featuresStatusSoon}
                  </span>
                )}
                <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
