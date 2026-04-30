import type { BillingInterval } from '@/lib/types/database'

export type PaidTier = 'basic' | 'premium'

const PRICE_MAP: Record<PaidTier, Record<BillingInterval, string | undefined>> = {
  basic: {
    monthly: process.env.STRIPE_PRICE_BASIC_MONTHLY,
    yearly: process.env.STRIPE_PRICE_BASIC_YEARLY,
  },
  premium: {
    monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY,
    yearly: process.env.STRIPE_PRICE_PREMIUM_YEARLY,
  },
}

export function resolvePriceId(tier: PaidTier, interval: BillingInterval): string {
  const id = PRICE_MAP[tier]?.[interval]
  if (!id) throw new Error(`Missing Stripe Price ID for ${tier}/${interval}`)
  return id
}

export function tierFromPriceId(priceId: string): { tier: PaidTier; interval: BillingInterval } | null {
  for (const tier of Object.keys(PRICE_MAP) as PaidTier[]) {
    for (const interval of Object.keys(PRICE_MAP[tier]) as BillingInterval[]) {
      if (PRICE_MAP[tier][interval] === priceId) return { tier, interval }
    }
  }
  return null
}

export function isValidTier(value: unknown): value is PaidTier {
  return value === 'basic' || value === 'premium'
}

export function isValidInterval(value: unknown): value is BillingInterval {
  return value === 'monthly' || value === 'yearly'
}
