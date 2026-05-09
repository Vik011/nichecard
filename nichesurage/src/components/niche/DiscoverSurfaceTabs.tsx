'use client'

import type { DiscoverSurface } from '@/lib/discover/fetchDiscoverFeed'

interface DiscoverSurfaceTabsProps {
  selected: DiscoverSurface
  onChange: (surface: DiscoverSurface) => void
}

const TABS: Array<{ id: DiscoverSurface; label: string; hint: string }> = [
  { id: 'all',         label: 'All',          hint: 'Top niches by score' },
  { id: 'spiking-now', label: 'Spiking Now',  hint: 'Active spike signal' },
  { id: 'just-added',  label: 'Just Added',   hint: 'Discovered last 7 days' },
]

/**
 * Top-row tab strip on /discover for filtering across "surface" views.
 * Different from the category chips below — surface tabs control WHICH
 * pool of niches we draw from (all / actively spiking / new arrivals).
 * Categories then narrow within that pool.
 *
 * Visual: pill-style segmented control. Emerald active, slate inactive.
 */
export function DiscoverSurfaceTabs({ selected, onChange }: DiscoverSurfaceTabsProps) {
  return (
    <div className="flex justify-center mb-5">
      <div className="inline-flex items-center gap-1 bg-charcoal-900/60 ring-1 ring-slate-800 rounded-full p-1" role="tablist">
        {TABS.map((tab) => {
          const active = selected === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              title={tab.hint}
              onClick={() => onChange(tab.id)}
              className={
                active
                  ? 'text-sm font-semibold px-5 py-2 rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 transition-colors'
                  : 'text-sm font-semibold px-5 py-2 rounded-full text-slate-400 hover:text-slate-200 transition-colors'
              }
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
