'use client'

import { CATEGORY_BUCKETS, type CategoryBucketId } from '@/lib/discover/categoryBuckets'

interface CategoryFilterChipsProps {
  /** Currently-selected bucket (null = "All"). */
  selected: CategoryBucketId | null
  /** Called with the new bucket id, or null when "All" is clicked. */
  onChange: (id: CategoryBucketId | null) => void
}

/**
 * Horizontal chip row for filtering /discover by category bucket.
 * 7 buckets + "All" → 8 chips total. Wraps on mobile.
 *
 * Active state = emerald accent (matches Premium ring + live indicator
 * brand convention). Inactive = slate ghost.
 */
export function CategoryFilterChips({ selected, onChange }: CategoryFilterChipsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 mb-6" role="radiogroup" aria-label="Category filter">
      <Chip active={selected === null} onClick={() => onChange(null)}>All</Chip>
      {CATEGORY_BUCKETS.map((bucket) => (
        <Chip
          key={bucket.id}
          active={selected === bucket.id}
          onClick={() => onChange(bucket.id)}
        >
          {bucket.label}
        </Chip>
      ))}
    </div>
  )
}

interface ChipProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function Chip({ active, onClick, children }: ChipProps) {
  const base = 'text-xs font-semibold px-3.5 py-1.5 rounded-full transition-colors whitespace-nowrap'
  const cls = active
    ? `${base} bg-accent-emerald/15 text-accent-emerald-bright ring-1 ring-accent-emerald/30`
    : `${base} bg-surface-raised/40 text-ink-muted ring-1 ring-hairline-edge hover:text-ink`
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cls}
    >
      {children}
    </button>
  )
}
