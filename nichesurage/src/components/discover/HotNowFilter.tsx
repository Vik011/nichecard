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

  return (
    <div
      role="tablist"
      aria-label="Discover mode"
      className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/60 p-1"
    >
      {buttons.map(b => {
        const active = mode === b.value
        return (
          <button
            key={b.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(b.value)}
            className={
              active
                ? 'rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition-colors'
                : 'rounded-full px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200'
            }
          >
            {b.label}
          </button>
        )
      })}
    </div>
  )
}
