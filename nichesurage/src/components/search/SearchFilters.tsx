'use client'

import type { SearchFilters as SearchFiltersType, ChannelAge } from '@/lib/types'

interface SearchFiltersProps {
  value: SearchFiltersType
  onChange: (updated: SearchFiltersType) => void
}

const CHANNEL_AGE_LABELS: Record<ChannelAge, string> = {
  '1month': '~1 month',
  '3months': '~3 months',
  '6months': '~6 months',
  '1year': '~1 year',
  any: "Doesn't matter",
}

export function SearchFilters({ value, onChange }: SearchFiltersProps) {
  const set = <K extends keyof SearchFiltersType>(key: K, val: SearchFiltersType[K]) =>
    onChange({ ...value, [key]: val })

  return (
    <div className="flex flex-col gap-4">
      {/* Content type toggle */}
      <div className="flex gap-2">
        {(['shorts', 'longform'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => set('contentType', type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              value.contentType === type
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Subscriber range */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="sub-min" className="text-slate-400 text-xs uppercase tracking-wide">
            Min
          </label>
          <input
            id="sub-min"
            type="number"
            min={0}
            value={value.subscriberMin}
            onChange={e => set('subscriberMin', Number(e.target.value))}
            className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-sm"
            placeholder="1 000"
          />
        </div>
        <span className="text-slate-500 mt-5">–</span>
        <div className="flex flex-col gap-1">
          <label htmlFor="sub-max" className="text-slate-400 text-xs uppercase tracking-wide">
            Max
          </label>
          <input
            id="sub-max"
            type="number"
            min={0}
            value={value.subscriberMax}
            onChange={e => set('subscriberMax', Number(e.target.value))}
            className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-sm"
            placeholder="100 000"
          />
        </div>
        <span className="text-slate-500 text-xs mt-5">subscribers</span>
      </div>

      {/* Channel age */}
      <div className="flex flex-col gap-1">
        <label htmlFor="channel-age" className="text-slate-400 text-xs uppercase tracking-wide">
          Channel Age
        </label>
        <select
          id="channel-age"
          value={value.channelAge}
          onChange={e => set('channelAge', e.target.value as ChannelAge)}
          className="w-48 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-sm"
        >
          {(Object.entries(CHANNEL_AGE_LABELS) as [ChannelAge, string][]).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* Viral-only toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.onlyRecentlyViral}
          onChange={e => set('onlyRecentlyViral', e.target.checked)}
          className="w-4 h-4 accent-indigo-500"
          aria-label="Only viral in last 5 days"
        />
        <span className="text-slate-300 text-sm">
          Only viral channels <span className="text-slate-500 text-xs">(last 5 days)</span>
        </span>
      </label>
    </div>
  )
}
