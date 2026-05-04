'use client'

import type { CopyKeys } from '@/components/landing/copy'

export type DiscoverMode = 'hot' | 'quality' | 'all'

interface HotNowFilterProps {
  mode: DiscoverMode
  onChange: (next: DiscoverMode) => void
  copy: CopyKeys
}

interface ModeButton {
  value: DiscoverMode
  label: string
}

export function HotNowFilter({ mode, onChange, copy }: HotNowFilterProps) {
  const buttons: ModeButton[] = [
    { value: 'hot',     label: copy.discoverModeHotLabel     },
    { value: 'quality', label: copy.discoverModeQualityLabel },
    { value: 'all',     label: copy.discoverModeAllLabel     },
  ]

  // We use plain buttons with aria-pressed (toggle-button group) instead of
  // role="tablist" — the WAI-ARIA tablist pattern expects ←/→ arrow-key nav
  // to move between tabs, which we don't implement. Buttons + aria-pressed
  // is the honest semantic for a segmented control without arrow nav.
  return (
    <div
      role="group"
      aria-label="Discover mode"
      className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/60 p-1"
    >
      {buttons.map(b => {
        const active = mode === b.value
        return (
          <button
            key={b.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(b.value)}
            className={
              active
                ? 'rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70'
                : 'rounded-full px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/40'
            }
          >
            {b.label}
          </button>
        )
      })}
    </div>
  )
}
