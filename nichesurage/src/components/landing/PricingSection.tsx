'use client'
import { useState } from 'react'
import type { CopyKeys } from './copy'

type Billing = 'monthly' | 'yearly'

interface PricingSectionProps {
  copy: CopyKeys
}

export function PricingSection({ copy }: PricingSectionProps) {
  const [billing, setBilling] = useState<Billing>('yearly')

  const tiers = [
    {
      name: copy.pricingFree,
      monthlyPrice: copy.pricingFreePrice,
      yearlyPrice: copy.pricingFreePrice,
      yearlyMonthly: null,
      perMonth: copy.pricingPerMonth,
      perYear: copy.pricingPerYear,
      features: copy.pricingFreeFeatures,
      cta: copy.pricingCtaFree,
      plan: 'free' as const,
      highlight: false,
      isPremium: false,
    },
    {
      name: copy.pricingBasic,
      monthlyPrice: copy.pricingBasicPrice,
      yearlyPrice: copy.pricingBasicYearlyPrice,
      yearlyMonthly: copy.pricingBasicYearlyMonthly,
      perMonth: copy.pricingPerMonth,
      perYear: copy.pricingPerYear,
      features: copy.pricingBasicFeatures,
      cta: copy.pricingCtaBasic,
      plan: 'basic' as const,
      highlight: true,
      isPremium: false,
    },
    {
      name: copy.pricingPremium,
      monthlyPrice: copy.pricingPremiumPrice,
      yearlyPrice: copy.pricingPremiumYearlyPrice,
      yearlyMonthly: copy.pricingPremiumYearlyMonthly,
      perMonth: copy.pricingPerMonth,
      perYear: copy.pricingPerYear,
      features: copy.pricingPremiumFeatures,
      cta: copy.pricingCtaPremium,
      plan: 'premium' as const,
      highlight: false,
      isPremium: true,
    },
  ]

  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 text-slate-100">
          {copy.pricingTitle}
        </h2>

        {/* Billing toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-1 bg-slate-800 rounded-full p-1">
            <button
              type="button"
              aria-pressed={billing === 'monthly'}
              onClick={() => setBilling('monthly')}
              className={
                billing === 'monthly'
                  ? 'px-5 py-2 rounded-full text-sm font-semibold bg-slate-600 text-white transition-all'
                  : 'px-5 py-2 rounded-full text-sm font-semibold text-slate-400 hover:text-slate-200 transition-all'
              }
            >
              {copy.pricingToggleMonthly}
            </button>
            <button
              type="button"
              aria-pressed={billing === 'yearly'}
              onClick={() => setBilling('yearly')}
              className={
                billing === 'yearly'
                  ? 'px-5 py-2 rounded-full text-sm font-semibold bg-indigo-600 text-white transition-all flex items-center gap-2'
                  : 'px-5 py-2 rounded-full text-sm font-semibold text-slate-400 hover:text-slate-200 transition-all flex items-center gap-2'
              }
            >
              {copy.pricingToggleYearly}
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-semibold">
                {copy.pricingYearlySaveBadge}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {tiers.map((tier) => {
            const isYearly = billing === 'yearly'
            const price = isYearly ? tier.yearlyPrice : tier.monthlyPrice
            const perLabel = isYearly ? tier.perYear : tier.perMonth
            const href = tier.plan === 'free'
              ? '/login?plan=free'
              : `/login?plan=${tier.plan}&billing=${billing}`

            return (
              <div
                key={tier.plan}
                className={
                  tier.highlight
                    ? 'relative bg-indigo-950 border-2 border-indigo-500 ring-2 ring-indigo-500/30 rounded-2xl p-8 shadow-xl shadow-indigo-900/20'
                    : tier.isPremium
                    ? 'relative bg-slate-900 border border-violet-500 rounded-2xl p-8'
                    : 'bg-slate-900 border border-slate-800 rounded-2xl p-8'
                }
              >
                {tier.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                )}
                {tier.isPremium && (
                  <span className="absolute -top-3 right-4 bg-violet-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    {copy.pricingBestValueBadge}
                  </span>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-slate-100 mb-2">{tier.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-slate-100">{price}</span>
                    <span className="text-slate-400 text-sm">{perLabel}</span>
                  </div>
                  {isYearly && tier.yearlyMonthly && (
                    <p className="text-slate-500 text-xs mt-1">{tier.yearlyMonthly}</p>
                  )}
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
                  href={href}
                  className={
                    tier.highlight
                      ? 'block w-full text-center py-3 px-4 rounded-xl font-semibold bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400 transition-all'
                      : 'block w-full text-center py-3 px-4 rounded-xl font-semibold border border-slate-700 text-slate-200 hover:border-slate-500 hover:text-white transition-colors'
                  }
                >
                  {tier.cta}
                </a>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
