'use client'

import type { CopyKeys } from './copy'

interface TierMatrixProps {
  copy: CopyKeys
}

// Sprint A.7 — capability comparison table that lives below the pricing
// cards. The pricing cards summarize each tier; this matrix lets a buyer
// scan capability-by-capability across all three tiers without flipping
// between cards. The user explicitly asked for this to live in-app
// alongside the FAQ as a sales surface.
export function TierMatrix({ copy }: TierMatrixProps) {
  const cols = copy.tierMatrixCol
  return (
    <section className="py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <h3 className="text-xl md:text-2xl font-semibold text-ink tracking-tight mb-6 text-center">
          {copy.tierMatrixTitle}
        </h3>
        <div className="overflow-x-auto rounded-2xl gborder bg-surface-raised/40 backdrop-blur-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-ink-subtle border-b border-hairline-edge/60">
                <th className="px-5 py-4 font-semibold">{cols.feature}</th>
                <th className="px-5 py-4 font-semibold">{cols.free}</th>
                <th className="px-5 py-4 font-semibold text-accent-emerald-bright">{cols.basic}</th>
                <th className="px-5 py-4 font-semibold">{cols.premium}</th>
              </tr>
            </thead>
            <tbody>
              {copy.tierMatrixRows.map((row, i) => (
                <tr
                  key={i}
                  className={
                    i % 2 === 0
                      ? 'bg-surface-raised/20'
                      : ''
                  }
                >
                  <td className="px-5 py-3.5 text-ink-muted font-medium">{row.label}</td>
                  <td className="px-5 py-3.5 text-ink-muted">{row.free}</td>
                  <td className="px-5 py-3.5 text-ink font-medium">{row.basic}</td>
                  <td className="px-5 py-3.5 text-ink-muted">{row.premium}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
