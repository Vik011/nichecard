import type { BillingInterval } from '@/lib/types/database'
import type { PaidTier } from '@/lib/stripe/prices'

/**
 * MRR (Monthly Recurring Revenue) calculation.
 *
 * Yearly subs contribute their /12 monthly equivalent (so a €90 yearly
 * Basic = €7.50/mo MRR, not €90/mo).
 *
 * Prices are kept in sync with the public pricing page (copy.ts). They're
 * static here because we charge in EUR and the public page is the source of
 * truth. If Stripe prices ever drift from these, MRR will be wrong — flag
 * any update by also editing this table.
 */

const MONTHLY_PRICE_EUR: Record<PaidTier, Record<BillingInterval, number>> = {
  basic: {
    monthly: 9, // €9 /mo
    yearly: 90 / 12, // €90 /yr → €7.50 /mo
  },
  premium: {
    monthly: 19, // €19 /mo
    yearly: 190 / 12, // €190 /yr → €15.83 /mo
  },
}

export interface SubBreakdown {
  tier: PaidTier
  interval: BillingInterval
  count: number
}

/**
 * Compute MRR from a list of (tier, interval, count) buckets. Output is
 * EUR/month. Unknown tier+interval combos are ignored (and logged) rather
 * than throwing — we'd rather underreport MRR than crash the dashboard.
 */
export function computeMrrEur(buckets: SubBreakdown[]): number {
  let mrr = 0
  for (const b of buckets) {
    const price = MONTHLY_PRICE_EUR[b.tier]?.[b.interval]
    if (price == null) {
      console.warn('[admin/mrr] unknown tier+interval combo:', b.tier, b.interval)
      continue
    }
    mrr += price * b.count
  }
  // Round to cents — the dashboard formats it back to EUR display.
  return Math.round(mrr * 100) / 100
}
