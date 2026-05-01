'use client'

import type { SearchFilters as SearchFiltersType, ChannelAge, SortBy } from '@/lib/types'
import { Check } from '@phosphor-icons/react/dist/ssr'

interface SearchFiltersProps {
  value: SearchFiltersType
  onChange: (updated: SearchFiltersType) => void
}

const CHANNEL_AGE_LABELS: Record<ChannelAge, string> = {
  '1month': '1 mo',
  '3months': '3 mo',
  '6months': '6 mo',
  '1year': '1 yr',
  any: 'Any',
}

const SORT_LABELS: Record<SortBy, string> = {
  score: 'Best score',
  newest: 'Newest',
}

const eyebrow = 'text-[10px] font-semibold tracking-[0.22em] uppercase text-glow-violet'

function pillClass(active: boolean): string {
  return [
    'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
    active
      ? 'bg-glow-violet/15 text-violet-100 ring-1 ring-glow-violet/40 shadow-[0_0_12px_-2px_rgba(157,128,232,0.35)]'
      : 'bg-charcoal-800/60 text-slate-400 hover:text-slate-100 hover:bg-charcoal-700/60',
  ].join(' ')
}

function inputClass(): string {
  return [
    'w-full bg-charcoal-800/60 gborder rounded-lg px-3 py-2 text-slate-100 text-sm tabular-nums',
    'focus:outline-none focus:ring-1 focus:ring-glow-violet/50 focus:bg-charcoal-800',
    'transition-all',
  ].join(' ')
}

export function SearchFilters({ value, onChange }: SearchFiltersProps) {
  const set = <K extends keyof SearchFiltersType>(key: K, val: SearchFiltersType[K]) =>
    onChange({ ...value, [key]: val })

  return (
    <div className="flex flex-col gap-5">
      {/* Content type */}
      <div className="flex flex-col gap-2">
        <span className={eyebrow}>Format</span>
        <div className="flex gap-2" role="radiogroup" aria-label="Format">
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
        <span className={eyebrow}>Subscriber range</span>
        <div className="flex items-center gap-2">
          <input
            id="sub-min"
            aria-label="Min subscribers"
            type="number"
            min={0}
            value={value.subscriberMin}
            onChange={e => set('subscriberMin', Number(e.target.value))}
            className={inputClass()}
            placeholder="1 000"
          />
          <span className="text-slate-600">–</span>
          <input
            id="sub-max"
            aria-label="Max subscribers"
            type="number"
            min={0}
            value={value.subscriberMax}
            onChange={e => set('subscriberMax', Number(e.target.value))}
            className={inputClass()}
            placeholder="100 000"
          />
        </div>
      </div>

      {/* Channel age */}
      <div className="flex flex-col gap-2">
        <span className={eyebrow}>Channel age</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Channel age">
          {(Object.entries(CHANNEL_AGE_LABELS) as [ChannelAge, string][]).map(([val, label]) => (
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
        <span className={eyebrow}>Sort by</span>
        <div className="flex gap-2" role="radiogroup" aria-label="Sort by">
          {(Object.entries(SORT_LABELS) as [SortBy, string][]).map(([val, label]) => (
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
        aria-label="Only viral in last 7 days"
        onClick={() => set('onlyRecentlyViral', !value.onlyRecentlyViral)}
        className={[
          'flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-all',
          value.onlyRecentlyViral
            ? 'bg-glow-violet/10 ring-1 ring-glow-violet/40 shadow-[0_0_12px_-2px_rgba(157,128,232,0.3)]'
            : 'bg-charcoal-800/60 hover:bg-charcoal-700/60',
        ].join(' ')}
      >
        <div className="flex flex-col">
          <span className="text-slate-100 text-sm font-medium">Only viral channels</span>
          <span className="text-slate-500 text-xs mt-0.5">spike ≥3× · last 7 days</span>
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
