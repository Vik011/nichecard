'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heartbeat, LockSimple } from '@phosphor-icons/react/dist/ssr'
import type { UserTier } from '@/lib/types'
import type { CopyKeys } from '@/components/landing/copy'
import { canUseAIFeatures } from '@/lib/tier'
import { AiQuotaExhausted } from './AiQuotaExhausted'

interface HealthCheckInlineProps {
  scanResultId: string
  userTier: UserTier
  copy: CopyKeys
}

interface HealthCheckResponse {
  score: number
  components: {
    spike: number
    opportunity: number
    engagement: number
    virality: number
    saturation: number
  }
  verdict: string
  cached: boolean
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: HealthCheckResponse }
  // Sprint A.7 — daily AI quota hit. Distinct from 'error' because the UI
  // surfaces the reset countdown + upgrade CTA, not a generic retry.
  | { kind: 'quota_exhausted'; resetAt: Date }

const STAGE_INTERVAL_MS = 6000

interface ScoreTierStyle {
  textClass: string
  label: string
}

function scoreTier(score: number, copy: CopyKeys): ScoreTierStyle {
  if (score >= 70) return { textClass: 'text-accent-emerald-bright', label: 'EXCELLENT' }
  if (score >= 50) return { textClass: 'text-accent-emerald-bright', label: 'STRONG' }
  if (score >= 30) return { textClass: 'text-amber-300', label: 'AVERAGE' }
  return { textClass: 'text-red-400', label: 'WEAK' }
  void copy
}

const eyebrow = 'text-[10px] font-semibold tracking-[0.22em] uppercase text-accent-emerald-bright'

export function HealthCheckInline({ scanResultId, userTier, copy }: HealthCheckInlineProps) {
  const allowed = canUseAIFeatures(userTier)
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    async function run() {
      setState({ kind: 'loading' })
      try {
        const res = await fetch(`/api/health-check/${encodeURIComponent(scanResultId)}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          if (cancelled) return
          if (res.status === 429 && body?.error === 'daily_limit' && body?.resetAt) {
            setState({ kind: 'quota_exhausted', resetAt: new Date(body.resetAt) })
            return
          }
          // Sprint A.9 Phase B: demo-niche pre-warm hasn't finished. Stay
          // in loading and retry after the suggested back-off so the user
          // never sees the locked teaser flash for the demo niche.
          // `warm_failed` is the terminal variant — on-demand pre-warm
          // already ran and still couldn't produce a cache row (Anthropic
          // outage). Surface it as a real error instead of looping.
          if (res.status === 503 && body?.error === 'warming_up') {
            const wait = Number(body.retryAfterSeconds ?? 5) * 1000
            retryTimer = setTimeout(() => { if (!cancelled) run() }, wait)
            return
          }
          setState({ kind: 'error', message: body?.error ?? `Request failed (${res.status})` })
          return
        }
        const data = (await res.json()) as HealthCheckResponse
        if (!cancelled) setState({ kind: 'ready', data })
      } catch (err) {
        if (!cancelled) setState({ kind: 'error', message: (err as Error).message })
      }
    }
    run()
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [scanResultId, allowed])

  if (!allowed) {
    return <LockedTeaser copy={copy} />
  }

  if (state.kind === 'quota_exhausted') {
    return <AiQuotaExhausted resetAt={state.resetAt} copy={copy} />
  }

  return (
    <section className="glass rounded-2xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Heartbeat weight="duotone" size={14} className="text-accent-emerald-bright" aria-hidden />
        <div className={eyebrow}>{copy.healthEyebrow}</div>
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-ink mb-5">
        {copy.healthHeading}
      </h2>

      {state.kind === 'loading' && <HealthLoading copy={copy} />}

      {state.kind === 'error' && (
        <div className="flex flex-col gap-3 items-start">
          <p className="text-red-400 text-sm">{copy.healthError}</p>
          <button
            type="button"
            onClick={() => setState({ kind: 'loading' })}
            className="text-[13px] font-semibold px-4 py-2 rounded-lg gborder bg-surface-elevated/60 text-ink hover:bg-surface-overlay/60 transition-colors"
          >
            {copy.anglesRetry}
          </button>
        </div>
      )}

      {state.kind === 'ready' && <ReadyBody data={state.data} copy={copy} />}
    </section>
  )
}

function ReadyBody({ data, copy }: { data: HealthCheckResponse; copy: CopyKeys }) {
  const tier = scoreTier(data.score, copy)
  const [expanded, setExpanded] = useState(false)
  const components: Array<{ key: keyof HealthCheckResponse['components']; label: string; max: number }> = [
    { key: 'spike', label: copy.healthCompSpike, max: 25 },
    { key: 'opportunity', label: copy.healthCompOpportunity, max: 25 },
    { key: 'engagement', label: copy.healthCompEngagement, max: 20 },
    { key: 'virality', label: copy.healthCompVirality, max: 15 },
    { key: 'saturation', label: copy.healthCompSaturation, max: 15 },
  ]

  return (
    <div data-testid="health-check-ready" className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex-1 flex flex-col gap-2 items-start">
          <p className={`text-ink text-[15px] leading-relaxed ${expanded ? '' : 'line-clamp-6'}`}>
            {data.verdict}
          </p>
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            data-testid="health-check-verdict-toggle"
            className="text-accent-emerald-bright text-xs font-medium transition-colors hover:brightness-110"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-baseline gap-2 justify-end">
            <span className={`text-5xl font-semibold tracking-tight tabular-nums ${tier.textClass}`}>
              {data.score}
            </span>
            <span className="text-ink-subtle text-sm">/100</span>
          </div>
          <span className={`text-[10px] font-semibold tracking-[0.22em] uppercase ${tier.textClass} mt-0.5 block`}>
            {tier.label}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {components.map(({ key, label, max }) => {
          const value = data.components[key] ?? 0
          const pct = Math.round((value / max) * 100)
          return (
            <div key={key} className="flex items-center gap-3 text-xs">
              <span className="w-28 text-ink-muted">{label}</span>
              <div className="flex-1 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-emerald-bright/80"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-12 text-right text-ink-subtle tabular-nums">
                {value.toFixed(1)}/{max}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HealthLoading({ copy }: { copy: CopyKeys }) {
  const stages = [copy.healthStage1, copy.healthStage2, copy.healthStage3, copy.healthStage4]
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setStage(s => Math.min(s + 1, stages.length - 1))
    }, STAGE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [stages.length])

  return (
    <div data-testid="health-check-loading" className="flex flex-col items-center gap-5 py-6">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-accent-emerald/10" />
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent-emerald-bright animate-spin"
          style={{ animationDuration: '1.6s' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Heartbeat weight="duotone" size={28} className="text-accent-emerald-bright animate-pulse" aria-hidden />
        </div>
      </div>

      <p className="text-ink text-sm font-medium text-center min-h-[1.25rem] transition-opacity duration-300">
        {stages[stage]}
      </p>

      <div className="flex items-center gap-1.5" aria-hidden>
        {stages.map((_, i) => (
          <div
            key={i}
            className={`h-1 w-10 rounded-full transition-colors duration-300 ${
              i <= stage ? 'bg-accent-emerald-bright' : 'bg-surface-overlay'
            }`}
          />
        ))}
      </div>

      <p className="text-ink-subtle text-[10px] uppercase tracking-[0.18em]">
        {copy.anglesLoadingHint}
      </p>
    </div>
  )
}

function LockedTeaser({ copy }: { copy: CopyKeys }) {
  return (
    <section className="glass rounded-2xl p-6 mb-6 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <Heartbeat weight="duotone" size={14} className="text-accent-emerald-bright" aria-hidden />
        <div className={eyebrow}>{copy.healthEyebrow}</div>
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-ink mb-5">
        {copy.healthHeading}
      </h2>

      <div className="flex flex-col gap-2" aria-hidden style={{ filter: 'blur(8px)', pointerEvents: 'none' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3 text-xs">
            <div className="w-28 h-3 bg-surface-elevated/80 rounded" />
            <div className="flex-1 h-1.5 bg-surface-elevated/60 rounded-full" />
            <div className="w-12 h-3 bg-surface-elevated/60 rounded" />
          </div>
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="glass rounded-2xl p-6 text-center max-w-sm w-full ring-1 ring-accent-emerald/30 shadow-[0_0_40px_-8px_rgba(16,185,129,0.35)]">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-emerald/10 ring-1 ring-accent-emerald/30 mb-3">
            <LockSimple weight="fill" size={20} className="text-accent-emerald-bright" aria-hidden />
          </div>
          <div className="text-[10px] font-semibold tracking-[0.22em] uppercase text-accent-emerald-bright mb-2">
            {copy.anglesLockedTitle}
          </div>
          <p className="text-ink-muted text-sm leading-relaxed mb-5">
            {copy.healthLockedBody}
          </p>
          <Link
            href="/#pricing"
            className="inline-block w-full text-[13px] font-semibold px-4 py-2.5 rounded-lg bg-white text-surface-raised hover:bg-slate-100 hover:shadow-none transition-all"
          >
            {copy.anglesUpgradeCta}
          </Link>
        </div>
      </div>
    </section>
  )
}
