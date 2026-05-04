'use client'

import Link from 'next/link'
import type { TrendClusterCard as Card } from '@/lib/types/trend'

interface Props {
  card: Card
}

/**
 * Sprint B Phase 7B — visual card for a single trend_cluster on
 * /discover/trending. Clicking navigates to /discover?cluster=<id>,
 * which the existing /discover page (Phase 7A) already supports as a
 * cluster drill-down.
 *
 * Mega clusters get a thin rose gradient border so they read distinct
 * from regular clusters even outside the dedicated "Cross-niche waves"
 * section the page renders above the main grid.
 */
export function TrendingClusterCard({ card }: Props) {
  const href = `/discover?cluster=${encodeURIComponent(card.id)}`

  const wrapperBase =
    'group block rounded-xl border bg-slate-900 p-4 transition-colors hover:border-indigo-500/50'
  const wrapperBorder = card.isMegaCluster
    ? 'border-rose-500/40 hover:border-rose-400/60 shadow-[0_0_18px_-6px_rgba(244,63,94,0.35)]'
    : 'border-slate-800'

  return (
    <Link
      href={href}
      className={`${wrapperBase} ${wrapperBorder}`}
      aria-label={`Open cluster ${card.label}`}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="text-slate-100 font-semibold text-sm leading-snug truncate">
          {card.label}
        </h3>
        {card.isMegaCluster && (
          <span className="shrink-0 inline-flex items-center rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
            🚨 Cross-niche
          </span>
        )}
      </div>

      {/* Archetype pill (optional) */}
      {card.narrativeArchetypeLabel && (
        <div className="mb-2">
          <span className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-200">
            {card.narrativeArchetypeLabel}
          </span>
        </div>
      )}

      {/* Sub-line stats */}
      <p className="text-slate-500 text-xs mb-3">
        {card.channelCount} channels · {card.videoCount} videos · score {card.avgTrendScore.toFixed(1)}
      </p>

      {/* Thumbnail strip — only render <img> for non-empty entries */}
      {card.sampleThumbnails.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5">
          {card.sampleThumbnails.map((src, i) => (
            <div key={`${card.id}-thumb-${i}`} className="aspect-video overflow-hidden rounded-md bg-slate-800">
              <img
                src={src}
                alt={card.sampleTitles[i] ?? card.label}
                loading="lazy"
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
            </div>
          ))}
        </div>
      )}
    </Link>
  )
}
