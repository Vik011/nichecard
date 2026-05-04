// Admin moderation table for narrative archetype candidates.
//
// Server-rendered. Approve / Reject use POST forms with a bound Server
// Action so we don't need a client fetch wrapper. Each form's `action`
// prop is the action with the row id pre-bound.

import type { PendingArchetype } from '@/lib/admin/queries'

interface ArchetypeModerationTableProps {
  pending: PendingArchetype[]
  approve: (id: string) => Promise<void>
  reject: (id: string) => Promise<void>
}

export function ArchetypeModerationTable({
  pending,
  approve,
  reject,
}: ArchetypeModerationTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800/60 bg-charcoal-900/60">
      <table className="w-full text-sm">
        <thead className="bg-charcoal-900 text-[11px] uppercase tracking-[0.14em] text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left">Slug</th>
            <th className="px-4 py-2 text-left">Label</th>
            <th className="px-4 py-2 text-left">Detections</th>
            <th className="px-4 py-2 text-left">First seen</th>
            <th className="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {pending.length === 0 && (
            <tr>
              <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                No archetype candidates pending review
              </td>
            </tr>
          )}
          {pending.map((a) => (
            <tr key={a.id} className="border-t border-slate-800/60">
              <td className="px-4 py-2 font-mono text-xs text-slate-400">{a.id}</td>
              <td className="px-4 py-2 text-slate-200">{a.display_label}</td>
              <td className="px-4 py-2 text-slate-300">{a.detection_count}</td>
              <td className="px-4 py-2 text-slate-500">{formatDate(a.first_detected_at)}</td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-2">
                  <form action={approve.bind(null, a.id)}>
                    <button
                      type="submit"
                      className="rounded border border-emerald-700/60 bg-emerald-950/40 px-3 py-1 text-xs uppercase tracking-wider text-emerald-200 hover:border-emerald-500"
                    >
                      Approve
                    </button>
                  </form>
                  <form action={reject.bind(null, a.id)}>
                    <button
                      type="submit"
                      className="rounded border border-rose-800/60 bg-rose-950/30 px-3 py-1 text-xs uppercase tracking-wider text-rose-200 hover:border-rose-600"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatDate(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return 'just now'
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}
