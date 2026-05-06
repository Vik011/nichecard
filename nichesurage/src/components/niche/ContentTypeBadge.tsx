// Format pill rendered on every NicheCard since the unified Discover surface
// stopped tab-splitting shorts vs longform. The badge replaces the prior tab
// split as the user-facing way to know what they are looking at.
//
// Visual distinction: shorts (compact, vertical icon hint via 'S') uses
// magenta tint; longform (wider, horizontal hint via 'LF') uses indigo.
// Both are subtle so they don't compete with the score number that
// dominates the card.

import type { ContentType } from '@/lib/types'

interface ContentTypeBadgeProps {
  type: ContentType
}

export function ContentTypeBadge({ type }: ContentTypeBadgeProps) {
  const isShorts = type === 'shorts'
  const label = isShorts ? 'SHORTS' : 'LONGFORM'
  const cls = isShorts
    ? 'bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-fuchsia-500/30'
    : 'bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30'

  return (
    <span
      aria-label={`Content format: ${label.toLowerCase()}`}
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider ${cls}`}
    >
      {label}
    </span>
  )
}
