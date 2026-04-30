'use client'

import { useEffect, useState } from 'react'
import { X } from '@phosphor-icons/react/dist/ssr'

interface HealthCheckModalProps {
  scanResultId: string
  nicheLabel: string
  onClose: () => void
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

const COMPONENT_LABELS: Array<{ key: keyof HealthCheckResponse['components']; label: string; max: number }> = [
  { key: 'spike', label: 'Spike', max: 25 },
  { key: 'opportunity', label: 'Opportunity', max: 25 },
  { key: 'engagement', label: 'Engagement', max: 20 },
  { key: 'virality', label: 'Virality', max: 15 },
  { key: 'saturation', label: 'Room to grow', max: 15 },
]

function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-300'
  if (score >= 50) return 'text-glow-violet'
  if (score >= 30) return 'text-amber-300'
  return 'text-red-400'
}

export function HealthCheckModal({ scanResultId, nicheLabel, onClose }: HealthCheckModalProps) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const resp = await fetch(`/api/health-check/${scanResultId}`)
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}))
          if (!cancelled) setState({ kind: 'error', message: body?.error ?? `Request failed (${resp.status})` })
          return
        }
        const data = (await resp.json()) as HealthCheckResponse
        if (!cancelled) setState({ kind: 'ready', data })
      } catch (err) {
        if (!cancelled) setState({ kind: 'error', message: (err as Error).message })
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [scanResultId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Niche Health Check for ${nicheLabel}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm px-4 py-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative glass glass-violet rounded-2xl w-full max-w-xl p-7">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 transition-colors p-1.5 rounded-lg"
        >
          <X weight="bold" size={18} aria-hidden />
        </button>

        <div className="mb-1 text-[10px] font-semibold tracking-[0.22em] text-glow-violet uppercase">
          Niche Health Check
        </div>
        <h2 className="text-xl font-semibold text-slate-100 tracking-tight mb-6">{nicheLabel}</h2>

        {state.kind === 'loading' && <LoadingBody />}
        {state.kind === 'error' && (
          <ErrorBody message={state.message} onRetry={() => setState({ kind: 'loading' })} />
        )}
        {state.kind === 'ready' && <ReadyBody data={state.data} />}
      </div>
    </div>
  )
}

function LoadingBody() {
  return (
    <div data-testid="health-check-loading" className="flex flex-col gap-4">
      <div className="h-16 rounded-xl bg-charcoal-800 animate-pulse" />
      <div className="h-3 rounded bg-charcoal-800 animate-pulse" />
      <div className="h-3 rounded bg-charcoal-800 animate-pulse w-5/6" />
      <div className="h-3 rounded bg-charcoal-800 animate-pulse w-4/6" />
      <p className="text-slate-500 text-xs mt-2">Reading the signals…</p>
    </div>
  )
}

function ErrorBody({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div data-testid="health-check-error" className="flex flex-col gap-3">
      <p className="text-red-400 text-sm">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="self-start text-[13px] font-semibold px-4 py-2 rounded-lg gborder bg-charcoal-800 text-slate-200 hover:bg-charcoal-700 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}

function ReadyBody({ data }: { data: HealthCheckResponse }) {
  return (
    <div data-testid="health-check-ready" className="flex flex-col gap-6">
      <div className="flex items-baseline gap-3">
        <span className={`text-6xl font-semibold tracking-tight ${scoreColor(data.score)}`}>
          {data.score}
        </span>
        <span className="text-slate-500 text-sm">/100</span>
      </div>

      <div className="flex flex-col gap-2">
        {COMPONENT_LABELS.map(({ key, label, max }) => {
          const value = data.components[key] ?? 0
          const pct = Math.round((value / max) * 100)
          return (
            <div key={key} className="flex items-center gap-3 text-xs">
              <span className="w-28 text-slate-400">{label}</span>
              <div className="flex-1 h-1.5 bg-charcoal-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-glow-indigo to-glow-violet"
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

      <p className="text-slate-200 text-[15px] leading-relaxed">{data.verdict}</p>

      {data.cached && (
        <p className="text-slate-600 text-[10px] uppercase tracking-[0.18em]">
          Cached · refreshes after 7 days
        </p>
      )}
    </div>
  )
}
