'use client'

import type { SearchFilters as SearchFiltersType, ChannelAge, SortBy } from '@/lib/types'
import { Check } from '@phosphor-icons/react/dist/ssr'
import { COPY, type CopyKeys } from '@/components/landing/copy'

interface SearchFiltersProps {
  value: SearchFiltersType
  onChange: (updated: SearchFiltersType) => void
  copy?: CopyKeys
}

function channelAgeLabels(c: CopyKeys): Record<ChannelAge, string> {
  return {
    '1month': c.filterAge1mo,
    '3months': c.filterAge3mo,
    '6months': c.filterAge6mo,
    '1year': c.filterAge1yr,
    any: c.filterAgeAny,
  }
}

function sortLabels(c: CopyKeys): Record<SortBy, string> {
  return {
    score: c.filterSortScore,
    newest: c.filterSortNewest,
  }
}

const SUBSCRIBER_BUCKETS: Array<{ key: string; min: number; max: number; label: string }> = [
  { key: 'any',        min: 0,      max: 10_000_000, label: 'Any' },
  { key: 'under-1k',   min: 0,      max: 1_000,      label: '< 1K' },
  { key: '1k-5k',      min: 1_000,  max: 5_000,      label: '1K – 5K' },
  { key: '5k-10k',     min: 5_000,  max: 10_000,     label: '5K – 10K' },
  { key: '10k-50k',    min: 10_000, max: 50_000,     label: '10K – 50K' },
  { key: '50k-100k',   min: 50_000, max: 100_000,    label: '50K – 100K' },
  { key: 'over-100k',  min: 100_000, max: 10_000_000, label: '100K+' },
]

const eyebrow = 'text-[10px] font-semibold tracking-[0.22em] uppercase text-glow-violet'

function pillClass(active: boolean): string {
  return [
    'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
    active
      ? 'bg-glow-violet/15 text-violet-100 ring-1 ring-glow-violet/40 shadow-[0_0_12px_-2px_rgba(157,128,232,0.35)]'
      : 'bg-charcoal-800/60 text-slate-400 hover:text-slate-100 hover:bg-charcoal-700/60',
  ].join(' ')
}

export function SearchFilters({ value, onChange, copy = COPY.en }: SearchFiltersProps) {
  const set = <K extends keyof SearchFiltersType>(key: K, val: SearchFiltersType[K]) =>
    onChange({ ...value, [key]: val })

  const ageLabels = channelAgeLabels(copy)
  const sortLabelsLocal = sortLabels(copy)

  return (
    <div className="flex flex-col gap-5">
      {/* Content type */}
      <div className="flex flex-col gap-2">
        <span className={eyebrow}>{copy.filterFormat}</span>
        <div className="flex gap-2" role="radiogroup" aria-label={copy.filterFormat}>
          {(['shorts', 'longform'] as const).map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={value.contentType === type}
              onClick={() => set('contentType', type)}
              className={pillClass(value.contentType === type) + ' flex-1'}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Subscriber range */}
      <div className="flex flex-col gap-2">
        <span className={eyebrow}>{copy.filterSubscriberRange}</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={copy.filterSubscriberRange}>
          {SUBSCRIBER_BUCKETS.map((bucket) => {
            const active = value.subscriberMin === bucket.min && value.subscriberMax === bucket.max
            return (
              <button
                key={bucket.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() =>
                  onChange({ ...value, subscriberMin: bucket.min, subscriberMax: bucket.max })
                }
                className={pillClass(active)}
              >
                {bucket.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Channel age */}
      <div className="flex flex-col gap-2">
        <span className={eyebrow}>{copy.filterChannelAge}</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={copy.filterChannelAge}>
          {(Object.entries(ageLabels) as [ChannelAge, string][]).map(([val, label]) => (
            <button
              key={val}
              type="button"
              role="radio"
              aria-checked={value.channelAge === val}
              onClick={() => set('channelAge', val)}
              className={pillClass(value.channelAge === val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div className="flex flex-col gap-2">
        <span className={eyebrow}>{copy.filterSortBy}</span>
        <div className="flex gap-2" role="radiogroup" aria-label={copy.filterSortBy}>
          {(Object.entries(sortLabelsLocal) as [SortBy, string][]).map(([val, label]) => (
            <button
              key={val}
              type="button"
              role="radio"
              aria-checked={value.sortBy === val}
              onClick={() => set('sortBy', val)}
              className={pillClass(value.sortBy === val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Viral-only toggle */}
      <button
        type="button"
        role="checkbox"
        aria-checked={value.onlyRecentlyViral}
        aria-label={copy.filterViralTitle}
        onClick={() => set('onlyRecentlyViral', !value.onlyRecentlyViral)}
        className={[
          'flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-all',
          value.onlyRecentlyViral
            ? 'bg-glow-violet/10 ring-1 ring-glow-violet/40 shadow-[0_0_12px_-2px_rgba(157,128,232,0.3)]'
            : 'bg-charcoal-800/60 hover:bg-charcoal-700/60',
        ].join(' ')}
      >
        <div className="flex flex-col">
          <span className="text-slate-100 text-sm font-medium">{copy.filterViralTitle}</span>
          <span className="text-slate-500 text-xs mt-0.5">{copy.filterViralSub}</span>
        </div>
        <span
          className={[
            'shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all',
            value.onlyRecentlyViral
              ? 'bg-glow-violet text-charcoal-900'
              : 'bg-charcoal-700 text-transparent',
          ].join(' ')}
          aria-hidden
        >
          <Check weight="bold" size={12} />
        </span>
      </button>
    </div>
  )
}
