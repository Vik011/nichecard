import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Robot, Clock, Flame, TrendUp, Lightbulb, BellSimple, Heartbeat } from '@phosphor-icons/react/dist/ssr'
import type { CopyKeys } from './copy'
import { MotionCard } from '@/components/ui/MotionCard'

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

// Spotlight features = the AI capabilities that genuinely differentiate
// SurgeNiche vs every other "trending channels" tracker. Audit (round 3,
// 2026-05-06): "AI Clone & Twist i AI Niche Health Check su zapravo
// unique features koje zaslužuju vizuelni tretman, ne samo ikonu i 2
// rečenice." Identified by icon — stable across copy renames.
const SPOTLIGHT_ICONS = new Set(['heartbeat', 'trend-up'])

export function FeaturesSection({ copy }: FeaturesSectionProps) {
  const spotlightFeatures = copy.features.filter((f) => SPOTLIGHT_ICONS.has(f.icon))
  const regularFeatures = copy.features.filter((f) => !SPOTLIGHT_ICONS.has(f.icon))

  return (
    <section id="how" className="py-24 px-6 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-display text-4xl md:text-5xl font-normal text-center mb-14 text-slate-100 tracking-[-0.01em]">
          {copy.featuresTitle}
        </h2>

        {/* Spotlight row — the AI differentiators get a larger, more
            visually weighty treatment than the supporting capabilities.
            Two-column on desktop, stacked on mobile. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          {spotlightFeatures.map((feature) => {
            const Icon = ICON_MAP[feature.icon]
            const status = 'status' in feature ? feature.status : undefined
            return (
              <MotionCard
                key={feature.title}
                className="relative rounded-2xl p-8 glass glass-glow ring-1 ring-emerald-500/25 shadow-[0_24px_60px_-16px_rgba(16,185,129,0.15)]"
              >
                <span
                  data-testid={`feature-premium-badge-${feature.icon}`}
                  className="absolute top-5 right-5 text-[10px] font-semibold tracking-[0.22em] text-emerald-300 uppercase"
                >
                  {copy.featuresPremiumBadge}
                </span>
                {Icon && (
                  <Icon
                    weight="duotone"
                    size={40}
                    aria-hidden="true"
                    data-testid={`feature-icon-${feature.icon}`}
                    className="text-emerald-300 mb-6"
                  />
                )}
                <h3 className="font-display text-2xl font-normal text-slate-100 mb-3 tracking-[-0.01em]">
                  {feature.title}
                </h3>
                {status && (
                  <span
                    data-testid={`feature-status-${feature.icon}`}
                    className={
                      status === 'live'
                        ? 'inline-block mb-4 text-[10px] font-semibold tracking-[0.18em] text-emerald-300 uppercase'
                        : 'inline-block mb-4 text-[10px] font-semibold tracking-[0.18em] text-slate-500 uppercase'
                    }
                  >
                    {status === 'live' ? copy.featuresStatusLive : copy.featuresStatusSoon}
                  </span>
                )}
                <p className="text-slate-300 text-[15px] leading-relaxed">{feature.desc}</p>
              </MotionCard>
            )
          })}
        </div>

        {/* Regular features — supporting capabilities in the original
            3-col grid treatment. With 5 cards, row 2 has only 2 cards;
            we force the 4th card to col-start-2 on lg so the orphan
            pair reads as a centered "tier 2 support" duo rather than
            a left-aligned remainder with empty space hanging right. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {regularFeatures.map((feature, i) => {
            const Icon = ICON_MAP[feature.icon]
            const isPremium = feature.tier === 'premium'
            const status = 'status' in feature ? feature.status : undefined
            // 4th card (index 3) starts at column 2 on lg; the 5th card
            // naturally lands in column 3 next to it. Result: bottom row
            // is centered (col-2 + col-3) with col-1 left empty. Only
            // applies when there are exactly 5 regulars — if the count
            // changes later, revisit this rule.
            const orphanCenterClass = i === 3 ? 'lg:col-start-2' : ''
            return (
              <MotionCard
                key={feature.title}
                className={`relative rounded-xl p-6 bg-charcoal-900 ${isPremium ? 'glass glass-glow' : 'gborder'} ${orphanCenterClass}`}
              >
                {isPremium && (
                  <span
                    data-testid={`feature-premium-badge-${feature.icon}`}
                    className="absolute top-4 right-4 text-[10px] font-semibold tracking-[0.18em] text-emerald-300 uppercase"
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
                    className="text-emerald-300 mb-5"
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
              </MotionCard>
            )
          })}
        </div>
      </div>
    </section>
  )
}
