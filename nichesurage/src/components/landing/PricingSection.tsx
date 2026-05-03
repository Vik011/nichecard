'use client'
import { useState } from 'react'
import type { CopyKeys } from './copy'
import { MotionCard } from '@/components/ui/MotionCard'
import { captureClient } from '@/lib/analytics/posthog-client'

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
        <h2 className="text-3xl md:text-4xl font-semibold text-center mb-8 text-slate-100 tracking-tight text-balance">
          {copy.pricingTitle}
        </h2>

        {/* Billing toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-1 glass rounded-full p-1">
            <button
              type="button"
              aria-pressed={billing === 'monthly'}
              onClick={() => setBilling('monthly')}
              className={
                billing === 'monthly'
                  ? 'px-5 py-2 rounded-full text-sm font-semibold bg-charcoal-700 text-slate-100 transition-all'
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
                  ? 'px-5 py-2 rounded-full text-sm font-semibold bg-gradient-to-br from-brand-indigo to-brand-indigo-bright text-white transition-all flex items-center gap-2'
                  : 'px-5 py-2 rounded-full text-sm font-semibold text-slate-400 hover:text-slate-200 transition-all flex items-center gap-2'
              }
            >
              {copy.pricingToggleYearly}
              <span className="text-[11px] text-emerald-300 font-semibold tracking-tight">
                {copy.pricingYearlySaveBadge}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {tiers.map((tier) => {
            const isYearly = billing === 'yearly'
            const price = isYearly ? tier.yearlyPrice : tier.monthlyPrice
            const perLabel = isYearly ? tier.perYear : tier.perMonth
            const href = tier.plan === 'free'
              ? '/login?plan=free'
              : `/login?plan=${tier.plan}&billing=${billing}`

            return (
              <MotionCard
                key={tier.plan}
                className={
                  tier.highlight
                    ? 'relative glass rounded-2xl p-8 ring-1 ring-glow-indigo/40'
                    : tier.isPremium
                    ? 'relative glass glass-glow rounded-2xl p-8'
                    : 'relative gborder bg-charcoal-900 rounded-2xl p-8'
                }
              >
                {tier.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-[0.22em] text-glow-indigo uppercase bg-charcoal-900 px-3">
                    Most Popular
                  </span>
                )}
                {tier.isPremium && (
                  <span className="absolute -top-3 right-6 text-[10px] font-semibold tracking-[0.22em] text-glow-indigo uppercase bg-charcoal-900 px-3">
                    {copy.pricingBestValueBadge}
                  </span>
                )}
                <div className="mb-6">
                  <h3 className="text-[15px] font-semibold text-slate-100 mb-3 uppercase tracking-[0.18em] text-slate-300">{tier.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-semibold text-slate-100 tracking-tight">{price}</span>
                    <span className="text-slate-400 text-sm">{perLabel}</span>
                  </div>
                  {isYearly && tier.yearlyMonthly && (
                    <p className="text-slate-500 text-xs mt-1.5">{tier.yearlyMonthly}</p>
                  )}
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-emerald-400/90 mt-0.5 shrink-0">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={href}
                  onClick={() => captureClient('pricing_cta_clicked', { plan: tier.plan, billing })}
                  className={
                    tier.highlight
                      ? 'block w-full text-center py-3 px-4 rounded-xl font-semibold bg-gradient-to-br from-brand-indigo to-brand-indigo-bright text-white hover:brightness-110 hover:shadow-glow-cyan transition-all shadow-[0_8px_24px_-8px_rgba(124,131,240,0.45)]'
                      : 'block w-full text-center py-3 px-4 rounded-xl font-semibold gborder bg-charcoal-800 text-slate-200 hover:bg-charcoal-700 transition-colors'
                  }
                >
                  {tier.cta}
                </a>
              </MotionCard>
            )
          })}
        </div>
      </div>
    </section>
  )
}
