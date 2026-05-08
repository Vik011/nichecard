import {
  getUserCounts,
  getMrrEur,
  getSignupsSince,
  getActiveUsersSince,
  getRecentSignups,
  getFailedWebhooks,
  getCronHealth,
  getAiUsageToday,
  findUsersByEmail,
  getStripeMode,
} from '@/lib/admin/queries'
import { StatCard } from '@/components/admin/StatCard'

// SSR fresh on every visit. Admin metrics need to be live, not cached.
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface AdminPageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams
  const lookupQuery = params.q?.trim() ?? ''

  // All queries run in parallel — there's no cross-dependency.
  const [
    counts,
    mrr,
    signupsToday,
    signupsWeek,
    dau,
    wau,
    recent,
    failed,
    cron,
    aiUsage,
    lookupResults,
  ] = await Promise.all([
    getUserCounts(),
    getMrrEur(),
    getSignupsSince(24),
    getSignupsSince(24 * 7),
    getActiveUsersSince(24),
    getActiveUsersSince(24 * 7),
    getRecentSignups(20),
    getFailedWebhooks(20),
    getCronHealth(),
    getAiUsageToday(),
    lookupQuery ? findUsersByEmail(lookupQuery, 25) : Promise.resolve([]),
  ])

  const stripeMode = getStripeMode()
  const conversionPct =
    counts.total > 0 ? ((counts.paying / counts.total) * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-10">
      {/* Stripe mode banner — bright signal so we never confuse test for live. */}
      <StripeModeBanner mode={stripeMode} />

      {/* Top-line KPIs */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Users
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total users" value={counts.total} />
          <StatCard label="Paying" value={counts.paying} hint={`${conversionPct}% conversion`} tone={counts.paying > 0 ? 'good' : 'default'} />
          <StatCard label="MRR" value={`€${mrr.toFixed(2)}`} hint="EUR / month" tone={mrr > 0 ? 'good' : 'default'} />
          <StatCard label="New today" value={signupsToday} />
          <StatCard label="DAU" value={dau} hint="signed in last 24h" />
          <StatCard label="WAU" value={wau} hint={`${signupsWeek} new this week`} />
        </div>

        {/* Tier breakdown — secondary row */}
        <div className="mt-3 grid grid-cols-3 gap-3">
          <StatCard label="Free" value={counts.free} />
          <StatCard label="Basic" value={counts.basic} />
          <StatCard label="Premium" value={counts.premium} tone={counts.premium > 0 ? 'good' : 'default'} />
        </div>
      </section>

      {/* Operational health */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Operations
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Last scan"
            value={cron.lastScanAt ? formatRelative(cron.lastScanAt) : '—'}
            hint={cron.lastScanAt ?? 'never run'}
            tone={
              cron.lastScanAt && Date.now() - new Date(cron.lastScanAt).getTime() > 6 * 3600 * 1000
                ? 'warn'
                : 'good'
            }
          />
          <StatCard
            label="Scan results 24h"
            value={cron.scanResultsLast24h}
            hint={`${cron.premiumLast24h} premium`}
          />
          <StatCard
            label="AI calls today"
            value={aiUsage}
            hint="ai_usage_daily count"
          />
          <StatCard
            label="Failed webhooks"
            value={failed.length}
            tone={failed.length > 0 ? 'bad' : 'good'}
          />
          <SentryLinkCard />
        </div>
      </section>

      {/* Trend engine section removed in 2026-05-07 trend-engine
          deprecation — Sprint B's trend_clusters / archetype pipeline
          was never bootstrapped in production and the readiness card
          was forever stuck on "Calibrating". Sonar (niche_clusters)
          remains the live discovery surface. */}

      {/* Recent signups */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Recent signups (latest {recent.length})
        </h2>
        <div className="overflow-hidden rounded-xl border border-slate-800/60 bg-charcoal-900/60">
          <table className="w-full text-sm">
            <thead className="bg-charcoal-900 text-[11px] uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Tier</th>
                <th className="px-4 py-2 text-left">Joined</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={3}>
                    No signups yet.
                  </td>
                </tr>
              )}
              {recent.map((u) => (
                <tr key={u.id} className="border-t border-slate-800/60">
                  <td className="px-4 py-2 text-slate-300">{u.email}</td>
                  <td className="px-4 py-2">
                    <TierBadge tier={u.tier} />
                  </td>
                  <td className="px-4 py-2 text-slate-500">{formatRelative(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Failed webhooks (only render when there are any) */}
      {failed.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-rose-400">
            ⚠ Failed webhooks
          </h2>
          <div className="overflow-hidden rounded-xl border border-rose-900/40 bg-rose-950/20">
            <table className="w-full text-sm">
              <thead className="bg-rose-950/30 text-[11px] uppercase tracking-[0.14em] text-rose-300">
                <tr>
                  <th className="px-4 py-2 text-left">Event ID</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Received</th>
                  <th className="px-4 py-2 text-left">Error</th>
                </tr>
              </thead>
              <tbody>
                {failed.map((e) => (
                  <tr key={e.event_id} className="border-t border-rose-900/30">
                    <td className="px-4 py-2 font-mono text-xs text-rose-200">{e.event_id}</td>
                    <td className="px-4 py-2 text-slate-300">{e.event_type}</td>
                    <td className="px-4 py-2 text-slate-500">{formatRelative(e.received_at)}</td>
                    <td className="px-4 py-2 text-rose-300">{e.processing_error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* User lookup — server-action-free, just a GET form */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          User lookup
        </h2>
        <form className="mb-3 flex gap-2" action="/admin">
          <input
            type="search"
            name="q"
            defaultValue={lookupQuery}
            placeholder="Search by email (partial match)"
            className="flex-1 rounded-lg border border-slate-800/60 bg-charcoal-900/60 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/40 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg border border-slate-800/60 bg-charcoal-900/60 px-4 py-2 text-sm text-slate-200 hover:border-slate-700"
          >
            Search
          </button>
        </form>
        {lookupQuery && (
          <div className="overflow-hidden rounded-xl border border-slate-800/60 bg-charcoal-900/60">
            <table className="w-full text-sm">
              <thead className="bg-charcoal-900 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Tier</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Joined</th>
                  <th className="px-4 py-2 text-left">User ID</th>
                </tr>
              </thead>
              <tbody>
                {lookupResults.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                      No matches for &quot;{lookupQuery}&quot;.
                    </td>
                  </tr>
                )}
                {lookupResults.map((u) => (
                  <tr key={u.id} className="border-t border-slate-800/60">
                    <td className="px-4 py-2 text-slate-300">{u.email}</td>
                    <td className="px-4 py-2">
                      <TierBadge tier={u.tier} />
                    </td>
                    <td className="px-4 py-2 text-slate-500">{u.subscription_status ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{formatRelative(u.created_at)}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-600">{u.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Sub-components (server) ──────────────────────────────────────────────

function StripeModeBanner({ mode }: { mode: 'live' | 'test' | 'unknown' }) {
  if (mode === 'live') {
    return (
      <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-300">
        <strong>Stripe: LIVE</strong> — payments are real.
      </div>
    )
  }
  if (mode === 'test') {
    return (
      <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200">
        <strong>Stripe: TEST</strong> — no real payments will be processed. Switch env vars to
        sk_live_/pk_live_ to go live.
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-rose-900/50 bg-rose-950/40 px-4 py-2 text-sm text-rose-300">
      <strong>Stripe: UNKNOWN</strong> — STRIPE_SECRET_KEY env var is missing or malformed.
    </div>
  )
}

function SentryLinkCard() {
  const sentryOrg = process.env.SENTRY_ORG
  const sentryProject = process.env.SENTRY_PROJECT
  const href =
    sentryOrg && sentryProject
      ? `https://${sentryOrg}.sentry.io/issues/?project=${sentryProject}`
      : 'https://sentry.io'
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-xl border border-slate-800/60 bg-charcoal-900/60 px-5 py-4 transition-colors hover:border-slate-700"
    >
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Errors</div>
      <div className="mt-2 text-base font-semibold text-slate-200">Open Sentry →</div>
      <div className="mt-1 text-xs text-slate-500">live error feed</div>
    </a>
  )
}

function TierBadge({ tier }: { tier: 'free' | 'basic' | 'premium' }) {
  const cls =
    tier === 'premium'
      ? 'border-emerald-600/40 bg-emerald-950/20 text-emerald-300'
      : tier === 'basic'
      ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-200'
      : 'border-slate-800/60 bg-charcoal-900/40 text-slate-400'
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-[11px] uppercase tracking-wider ${cls}`}>
      {tier}
    </span>
  )
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return 'just now'
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}
