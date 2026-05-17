'use client'

import Link from 'next/link'
import { Sparkle, ArrowRight } from '@phosphor-icons/react/dist/ssr'
import type { CopyKeys } from '@/components/landing/copy'
import { useFreeDemoState } from '@/lib/demo/useFreeDemoState'

interface FreeDemoBannerProps {
  /** scan_result.id of the niche being rendered. Compared against the */
  /** server-pinned daily demo to suppress hand-crafted ?freeDemo=true URLs. */
  nicheId: string
  copy: CopyKeys
}

/**
 * Welcome banner shown on the user's first-login demo niche detail page.
 * The validation logic lives in `useFreeDemoState` so this component and
 * NicheDetailContent agree on whether the niche is legitimately today's
 * demo (and therefore whether to unlock the AI sections).
 */
export function FreeDemoBanner({ nicheId, copy }: FreeDemoBannerProps) {
  const state = useFreeDemoState(nicheId)
  if (state !== 'legitimate') return null

  return (
    <section
      role="status"
      aria-live="polite"
      className="glass glass-glow rounded-2xl p-5 mb-6 flex items-start gap-4 border border-accent-emerald-bright/20"
    >
      <div className="shrink-0 mt-0.5">
        <Sparkle weight="duotone" size={22} className="text-accent-emerald-bright" aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-ink text-sm font-medium leading-snug">
          {copy.freeDemoBannerHeadline}
        </p>
        <p className="text-ink-muted text-[13px] leading-snug mt-1">
          {copy.freeDemoBannerSub}
        </p>
      </div>
      <Link
        href="/discover"
        className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-indigo-300 hover:text-indigo-200 transition-colors"
      >
        {copy.freeDemoBannerCta}
        <ArrowRight weight="bold" size={14} aria-hidden />
      </Link>
    </section>
  )
}
