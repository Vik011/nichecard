// Single-purpose card for the admin dashboard. Server-rendered, so we don't
// pay any JS bundle cost for what's essentially a labeled number.

interface StatCardProps {
  label: string
  value: string | number
  /** Small subtitle under the value (e.g. percentage, comparison). */
  hint?: string
  /** Highlight color for the value (semantic). */
  tone?: 'default' | 'good' | 'warn' | 'bad'
}

export function StatCard({ label, value, hint, tone = 'default' }: StatCardProps) {
  const valueClass =
    tone === 'good'
      ? 'text-emerald-300'
      : tone === 'warn'
      ? 'text-amber-300'
      : tone === 'bad'
      ? 'text-rose-300'
      : 'text-slate-100'

  return (
    <div className="rounded-xl border border-slate-800/60 bg-charcoal-900/60 px-5 py-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight ${valueClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}
