'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkle, LockSimple } from '@phosphor-icons/react/dist/ssr'
import type { ContentAngle, UserTier } from '@/lib/types'
import type { CopyKeys } from '@/components/landing/copy'
import { canUseAIFeatures } from '@/lib/tier'
import { captureClient } from '@/lib/analytics/posthog-client'
import { AiQuotaExhausted } from './AiQuotaExhausted'

const STAGE_INTERVAL_MS = 6500

interface AIContentAnglesProps {
  scanResultId: string
  userTier: UserTier
  copy: CopyKeys
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; angles: ContentAngle[] }
  // Sprint A.7 — see HealthCheckInline for the same shape.
  | { kind: 'quota_exhausted'; resetAt: Date }

const eyebrow = 'text-[10px] font-semibold tracking-[0.22em] uppercase text-glow-indigo'

export function AIContentAngles({ scanResultId, userTier, copy }: AIContentAnglesProps) {
  const allowed = canUseAIFeatures(userTier)
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    async function run() {
      setState({ kind: 'loading' })
      try {
        const res = await fetch(`/api/content-angles/${encodeURIComponent(scanResultId)}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          if (cancelled) return
          if (res.status === 429 && body?.error === 'daily_limit' && body?.resetAt) {
            setState({ kind: 'quota_exhausted', resetAt: new Date(body.resetAt) })
            return
          }
          setState({ kind: 'error', message: body?.error ?? `Request failed (${res.status})` })
          return
        }
        const data = (await res.json()) as { angles: ContentAngle[] }
        if (!cancelled) setState({ kind: 'ready', angles: data.angles ?? [] })
      } catch (err) {
        if (!cancelled) setState({ kind: 'error', message: (err as Error).message })
      }
    }
    run()
    return () => { cancelled = true }
  }, [scanResultId, allowed])

  if (!allowed) {
    return <LockedTeaser copy={copy} userTier={userTier} />
  }

  if (state.kind === 'quota_exhausted') {
    return <AiQuotaExhausted resetAt={state.resetAt} copy={copy} />
  }

  return (
    <section className="glass glass-glow rounded-2xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Sparkle weight="fill" size={14} className="text-glow-indigo" aria-hidden />
        <div className={eyebrow}>{copy.anglesEyebrow}</div>
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-slate-100 mb-5">
        {copy.anglesHeading}
      </h2>

      {state.kind === 'loading' && <AnglesLoading copy={copy} />}

      {state.kind === 'error' && (
        <div className="flex flex-col gap-3 items-start">
          <p className="text-red-400 text-sm">{copy.anglesError}</p>
          <button
            type="button"
            onClick={() => setState({ kind: 'loading' })}
            className="text-[13px] font-semibold px-4 py-2 rounded-lg gborder bg-charcoal-800/60 text-slate-200 hover:bg-charcoal-700/60 transition-colors"
          >
            {copy.anglesRetry}
          </button>
        </div>
      )}

      {state.kind === 'ready' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {state.angles.map((angle, i) => (
            <AngleCard key={i} angle={angle} copy={copy} />
          ))}
        </div>
      )}
    </section>
  )
}

function AngleCard({ angle, copy }: { angle: ContentAngle; copy: CopyKeys }) {
  const formatLabel = angle.format === 'shorts' ? copy.anglesShorts : copy.anglesLongform
  return (
    <div data-testid="angle-card" className="glass rounded-xl p-4 flex flex-col gap-2">
      <span className="self-start text-[10px] font-semibold tracking-[0.18em] uppercase px-2 py-0.5 rounded-md bg-glow-indigo/15 text-indigo-200 ring-1 ring-glow-indigo/40">
        {formatLabel}
      </span>
      <h3 className="text-slate-100 text-base font-semibold leading-snug">{angle.title}</h3>
      <p className="text-slate-300 text-sm italic leading-relaxed">&ldquo;{angle.hook}&rdquo;</p>
      <div className="mt-2 pt-3 border-t border-slate-800/60">
        <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-slate-500 mb-1">
          {copy.anglesWhy}
        </div>
        <p className="text-slate-400 text-xs leading-relaxed">{angle.why}</p>
      </div>
    </div>
  )
}

function AnglesLoading({ copy }: { copy: CopyKeys }) {
  const stages = [copy.anglesStage1, copy.anglesStage2, copy.anglesStage3, copy.anglesStage4]
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setStage(s => Math.min(s + 1, stages.length - 1))
    }, STAGE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [stages.length])

  return (
    <div data-testid="angles-loading" className="flex flex-col items-center gap-5 py-6">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-glow-indigo opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-glow-indigo" />
        </span>
        <p className="text-slate-200 text-sm font-medium tabular-nums transition-opacity duration-300">
          {stages[stage]}
        </p>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 w-full mt-2 opacity-40">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="glass rounded-xl p-4 flex flex-col gap-2">
            <div className="h-4 w-16 bg-charcoal-800/80 rounded animate-pulse" />
            <div className="h-5 w-3/4 bg-charcoal-800/60 rounded animate-pulse" />
            <div className="h-4 w-full bg-charcoal-800/40 rounded animate-pulse" />
            <div className="h-3 w-2/3 bg-charcoal-800/40 rounded animate-pulse mt-2" />
          </div>
        ))}
      </div>
    </div>
  )
}

function LockedTeaser({ copy, userTier }: { copy: CopyKeys; userTier: UserTier }) {
  return (
    <section className="glass glass-glow rounded-2xl p-6 mb-6 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <Sparkle weight="fill" size={14} className="text-glow-indigo" aria-hidden />
        <div className={eyebrow}>{copy.anglesEyebrow}</div>
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-slate-100 mb-5">
        {copy.anglesHeading}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" aria-hidden style={{ filter: 'blur(8px)', pointerEvents: 'none' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="glass rounded-xl p-4 flex flex-col gap-2">
            <div className="h-4 w-16 bg-charcoal-800/80 rounded" />
            <div className="h-5 w-3/4 bg-charcoal-800/60 rounded" />
            <div className="h-4 w-full bg-charcoal-800/40 rounded" />
            <div className="h-4 w-5/6 bg-charcoal-800/40 rounded" />
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
            {copy.anglesLockedBody}
          </p>
          <Link
            href="/pricing"
            onClick={() => captureClient('upgrade_cta_clicked', { source: 'ai_angles_locked', tier: userTier })}
            className="inline-block w-full text-[13px] font-semibold px-4 py-2.5 rounded-lg bg-gradient-to-br from-brand-indigo to-brand-indigo-bright text-white hover:brightness-110 hover:shadow-glow-cyan transition-all shadow-[0_8px_24px_-6px_rgba(124,131,240,0.45)]"
          >
            {copy.anglesUpgradeCta}
          </Link>
        </div>
      </div>
    </section>
  )
}
