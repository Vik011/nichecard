import type { CopyKeys } from './copy'

interface PricingSectionProps {
  copy: CopyKeys
}

const TIERS = [
  { key: 'free' as const, plan: 'free' },
  { key: 'basic' as const, plan: 'basic', highlight: true },
  { key: 'premium' as const, plan: 'premium' },
]

export function PricingSection({ copy }: PricingSectionProps) {
  const tiers = [
    {
      name: copy.pricingFree,
      price: copy.pricingFreePrice,
      features: copy.pricingFreeFeatures,
      cta: copy.pricingCtaFree,
      plan: 'free',
      highlight: false,
      isPremium: false,
    },
    {
      name: copy.pricingBasic,
      price: copy.pricingBasicPrice,
      features: copy.pricingBasicFeatures,
      cta: copy.pricingCtaBasic,
      plan: 'basic',
      highlight: true,
      isPremium: false,
    },
    {
      name: copy.pricingPremium,
      price: copy.pricingPremiumPrice,
      features: copy.pricingPremiumFeatures,
      cta: copy.pricingCtaPremium,
      plan: 'premium',
      highlight: false,
      isPremium: true,
    },
  ]

  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-slate-100">
          {copy.pricingTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {tiers.map((tier) => (
            <div
              key={tier.plan}
              className={
                tier.highlight
                  ? 'relative bg-indigo-950 border-2 border-indigo-500 ring-2 ring-indigo-500/30 rounded-2xl p-8 shadow-xl shadow-indigo-900/20'
                  : tier.isPremium
                  ? 'bg-slate-900 border border-violet-500 rounded-2xl p-8'
                  : 'bg-slate-900 border border-slate-800 rounded-2xl p-8'
              }
            >
              {tier.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-100 mb-2">{tier.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-slate-100">{tier.price}</span>
                  <span className="text-slate-400 text-sm">{copy.pricingPerMonth}</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <a
                href={`/login?plan=${tier.plan}`}
                className={
                  tier.highlight
                    ? 'block w-full text-center py-3 px-4 rounded-xl font-semibold bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400 transition-all'
                    : 'block w-full text-center py-3 px-4 rounded-xl font-semibold border border-slate-700 text-slate-200 hover:border-slate-500 hover:text-white transition-colors'
                }
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
