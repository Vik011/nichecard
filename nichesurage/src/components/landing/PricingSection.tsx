'use client'
import { useState } from 'react'
import { CheckCircle } from '@phosphor-icons/react/dist/ssr'
import type { CopyKeys } from './copy'
import { MotionCard } from '@/components/ui/MotionCard'
import { captureClient } from '@/lib/analytics/posthog-client'

type Billing = 'monthly' | 'yearly'

interface PricingSectionProps {
  copy: CopyKeys
}

export function PricingSection({ copy }: PricingSectionProps) {
  // Default to monthly so first-time visitors anchor on the lower per-tier
  // numbers (€9 / €19 monthly read very differently than €90 / €190 yearly,
  // even though the yearly price is mathematically a discount). Users who
  // care about the savings will toggle to yearly themselves; the "Save 17%"
  // badge on the toggle does the heavy lifting there.
  const [billing, setBilling] = useState<Billing>('monthly')

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
        <h2 className="font-display text-4xl md:text-5xl font-normal text-center mb-8 text-ink tracking-[-0.01em] text-balance">
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
                  ? 'px-5 py-2 rounded-full text-sm font-semibold bg-surface-overlay text-ink transition-all'
                  : 'px-5 py-2 rounded-full text-sm font-semibold text-ink-muted hover:text-ink transition-all'
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
                  ? 'px-5 py-2 rounded-full text-sm font-semibold bg-accent-emerald/15 text-accent-emerald-bright ring-1 ring-accent-emerald/30 transition-all flex items-center gap-2'
                  : 'px-5 py-2 rounded-full text-sm font-semibold text-ink-muted hover:text-ink transition-all flex items-center gap-2'
              }
            >
              {copy.pricingToggleYearly}
              <span className="text-[11px] text-accent-emerald-bright font-semibold tracking-tight">
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
                    ? 'relative glass rounded-2xl p-8 ring-1 ring-accent-emerald/30'
                    : tier.isPremium
                    ? 'relative bg-surface-raised rounded-2xl p-8 ring-1 ring-premium-gold/20 premium-card-glow'
                    : 'relative gborder bg-surface-raised rounded-2xl p-8'
                }
              >
                {tier.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-[0.22em] text-accent-emerald-bright uppercase bg-surface-raised px-3">
                    Most Popular
                  </span>
                )}
                {tier.isPremium && (
                  <>
                    {/* Clip wrapper: matches the card box, clips the hairline
                        and top gradient to the rounded corners. The card
                        itself stays overflow-visible so the badge can
                        straddle the top edge. */}
                    <div
                      aria-hidden
                      className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none"
                    >
                      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-premium-gold/80 to-transparent" />
                      <div className="absolute top-0 inset-x-0 h-[15%] bg-gradient-to-b from-premium-gold/[0.07] to-transparent" />
                    </div>
                    <span className="absolute -top-3 right-6 text-[9px] font-medium tracking-[0.28em] text-premium-gold/75 uppercase bg-surface-raised px-3">
                      {copy.pricingBestValueBadge}
                    </span>
                  </>
                )}
                <div className="mb-6">
                  <h3
                    className={`text-[15px] font-semibold mb-3 uppercase tracking-[0.18em] ${
                      tier.isPremium ? 'text-premium-gold' : 'text-ink-muted'
                    }`}
                  >
                    {tier.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-semibold text-ink tracking-tight">{price}</span>
                    <span className="text-ink-muted text-sm">{perLabel}</span>
                  </div>
                  {isYearly && tier.yearlyMonthly && (
                    <p className="text-ink-subtle text-xs mt-1.5">{tier.yearlyMonthly}</p>
                  )}
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-ink-muted">
                      <CheckCircle
                        aria-hidden
                        weight="fill"
                        size={16}
                        className={`mt-0.5 shrink-0 ${
                          tier.isPremium
                            ? 'text-premium-gold'
                            : 'text-accent-emerald-bright/90'
                        }`}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={href}
                  onClick={() => captureClient('pricing_cta_clicked', { plan: tier.plan, billing })}
                  className={
                    tier.highlight
                      ? 'block w-full text-center py-3 px-4 rounded-xl font-semibold bg-white text-surface-raised hover:bg-slate-100 transition-all shadow-[0_8px_24px_-8px_rgba(0,0,0,0.2)]'
                      : tier.isPremium
                      ? 'block w-full text-center py-3 px-4 rounded-xl font-semibold bg-premium-gold text-premium-canvas-deep hover:bg-premium-gold-bright transition-all'
                      : 'block w-full text-center py-3 px-4 rounded-xl font-semibold gborder bg-surface-elevated text-ink hover:bg-surface-overlay transition-colors'
                  }
                >
                  {tier.cta}
                </a>
                {tier.isPremium && (
                  <p className="text-center text-[11px] text-ink-subtle mt-3">
                    {copy.pricingPremiumTrust}
                  </p>
                )}
              </MotionCard>
            )
          })}
        </div>
      </div>
    </section>
  )
}
