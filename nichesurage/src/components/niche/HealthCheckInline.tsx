'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heartbeat, LockSimple } from '@phosphor-icons/react/dist/ssr'
import type { UserTier } from '@/lib/types'
import type { CopyKeys } from '@/components/landing/copy'
import { canUseAIFeatures } from '@/lib/tier'

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

const STAGE_INTERVAL_MS = 6000

interface ScoreTierStyle {
  textClass: string
  label: string
}

function scoreTier(score: number, copy: CopyKeys): ScoreTierStyle {
  if (score >= 70) return { textClass: 'text-emerald-300', label: 'EXCELLENT' }
  if (score >= 50) return { textClass: 'text-glow-indigo', label: 'STRONG' }
  if (score >= 30) return { textClass: 'text-amber-300', label: 'AVERAGE' }
  return { textClass: 'text-red-400', label: 'WEAK' }
  void copy
}

const eyebrow = 'text-[10px] font-semibold tracking-[0.22em] uppercase text-glow-indigo'

export function HealthCheckInline({ scanResultId, userTier, copy }: HealthCheckInlineProps) {
  const allowed = canUseAIFeatures(userTier)
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    async function run() {
      setState({ kind: 'loading' })
      try {
        const res = await fetch(`/api/health-check/${encodeURIComponent(scanResultId)}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          if (!cancelled) {
            setState({ kind: 'error', message: body?.error ?? `Request failed (${res.status})` })
          }
          return
        }
        const data = (await res.json()) as HealthCheckResponse
        if (!cancelled) setState({ kind: 'ready', data })
      } catch (err) {
        if (!cancelled) setState({ kind: 'error', message: (err as Error).message })
      }
    }
    run()
    return () => { cancelled = true }
  }, [scanResultId, allowed])

  if (!allowed) {
    return <LockedTeaser copy={copy} />
  }

  return (
    <section className="glass rounded-2xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Heartbeat weight="duotone" size={14} className="text-glow-indigo" aria-hidden />
        <div className={eyebrow}>{copy.healthEyebrow}</div>
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-slate-100 mb-5">
        {copy.healthHeading}
      </h2>

      {state.kind === 'loading' && <HealthLoading copy={copy} />}

      {state.kind === 'error' && (
        <div className="flex flex-col gap-3 items-start">
          <p className="text-red-400 text-sm">{copy.healthError}</p>
          <button
            type="button"
            onClick={() => setState({ kind: 'loading' })}
            className="text-[13px] font-semibold px-4 py-2 rounded-lg gborder bg-charcoal-800/60 text-slate-200 hover:bg-charcoal-700/60 transition-colors"
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
        <p className="text-slate-200 text-[15px] leading-relaxed flex-1">{data.verdict}</p>
        <div className="shrink-0 text-right">
          <div className="flex items-baseline gap-2 justify-end">
            <span className={`text-5xl font-semibold tracking-tight tabular-nums ${tier.textClass}`}>
              {data.score}
            </span>
            <span className="text-slate-500 text-sm">/100</span>
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
              <span className="w-28 text-slate-400">{label}</span>
              <div className="flex-1 h-1.5 bg-charcoal-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-indigo to-brand-indigo-bright"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-12 text-right text-slate-500 tabular-nums">
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
        <div className="absolute inset-0 rounded-full border-2 border-glow-indigo/15" />
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-glow-indigo animate-spin"
          style={{ animationDuration: '1.6s' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Heartbeat weight="duotone" size={28} className="text-glow-indigo animate-pulse" aria-hidden />
        </div>
      </div>

      <p className="text-slate-200 text-sm font-medium text-center min-h-[1.25rem] transition-opacity duration-300">
        {stages[stage]}
      </p>

      <div className="flex items-center gap-1.5" aria-hidden>
        {stages.map((_, i) => (
          <div
            key={i}
            className={`h-1 w-10 rounded-full transition-colors duration-300 ${
              i <= stage ? 'bg-glow-indigo' : 'bg-charcoal-700'
            }`}
          />
        ))}
      </div>

      <p className="text-slate-600 text-[10px] uppercase tracking-[0.18em]">
        {copy.anglesLoadingHint}
      </p>
    </div>
  )
}

function LockedTeaser({ copy }: { copy: CopyKeys }) {
  return (
    <section className="glass rounded-2xl p-6 mb-6 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <Heartbeat weight="duotone" size={14} className="text-glow-indigo" aria-hidden />
        <div className={eyebrow}>{copy.healthEyebrow}</div>
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-slate-100 mb-5">
        {copy.healthHeading}
      </h2>

      <div className="flex flex-col gap-2" aria-hidden style={{ filter: 'blur(8px)', pointerEvents: 'none' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3 text-xs">
            <div className="w-28 h-3 bg-charcoal-800/80 rounded" />
            <div className="flex-1 h-1.5 bg-charcoal-800/60 rounded-full" />
            <div className="w-12 h-3 bg-charcoal-800/60 rounded" />
          </div>
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="glass rounded-2xl p-6 text-center max-w-sm w-full ring-1 ring-glow-indigo/40 shadow-[0_0_40px_-8px_rgba(157,128,232,0.45)]">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-glow-indigo/15 ring-1 ring-glow-indigo/40 mb-3">
            <LockSimple weight="fill" size={20} className="text-glow-indigo" aria-hidden />
          </div>
          <div className="text-[10px] font-semibold tracking-[0.22em] uppercase text-glow-indigo mb-2">
            {copy.anglesLockedTitle}
          </div>
          <p className="text-slate-300 text-sm leading-relaxed mb-5">
            {copy.healthLockedBody}
          </p>
          <Link
            href="/pricing"
            className="inline-block w-full text-[13px] font-semibold px-4 py-2.5 rounded-lg bg-gradient-to-br from-brand-indigo to-brand-indigo-bright text-white hover:brightness-110 hover:shadow-glow-cyan transition-all shadow-[0_8px_24px_-6px_rgba(124,131,240,0.45)]"
          >
            {copy.anglesUpgradeCta}
          </Link>
        </div>
      </div>
    </section>
  )
}
