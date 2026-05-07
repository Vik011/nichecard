import type { NicheCardData, UserTier } from '@/lib/types'
import type { CopyKeys } from '@/components/landing/copy'
import { YoutubeLogo } from '@phosphor-icons/react/dist/ssr'
import { BookmarkButton } from '@/components/niche/BookmarkButton'

interface ScoreTier {
  textClass: string
  glowShadow: string
  label: string
}

function scoreTier(score: number): ScoreTier {
  if (score >= 70) return {
    textClass: 'text-emerald-400',
    glowShadow: 'drop-shadow-[0_0_24px_rgba(52,211,153,0.55)]',
    label: 'EXCELLENT',
  }
  if (score >= 50) return {
    textClass: 'text-indigo-300',
    glowShadow: 'drop-shadow-[0_0_24px_rgba(167,139,250,0.55)]',
    label: 'STRONG',
  }
  if (score >= 30) return {
    textClass: 'text-amber-300',
    glowShadow: 'drop-shadow-[0_0_18px_rgba(252,211,77,0.40)]',
    label: 'AVERAGE',
  }
  return {
    textClass: 'text-red-400',
    glowShadow: 'drop-shadow-[0_0_18px_rgba(248,113,113,0.40)]',
    label: 'WEAK',
  }
}

interface NicheDetailHeaderProps {
  niche: NicheCardData
  copy: CopyKeys
  /**
   * Save-niche state. Optional so callers that don't have the saved-set
   * (e.g. the standalone /discover/niche/[id] page before SSR fully
   * wires it up) can render the header without the bookmark button.
   * Pass all three together — the BookmarkButton itself enforces tier
   * limits and the upgrade tooltip.
   */
  userTier?: UserTier
  isSaved?: boolean
  savedCount?: number
  onBookmarkToggle?: (id: string, saved: boolean) => void
}

export function NicheDetailHeader({
  niche,
  copy,
  userTier,
  isSaved,
  savedCount,
  onBookmarkToggle,
}: NicheDetailHeaderProps) {
  const tier = scoreTier(niche.opportunityScore)
  const eyebrow = niche.contentType === 'shorts' ? copy.discoverShortsEyebrow : copy.discoverLongformEyebrow

  return (
    <section className="glass glass-glow rounded-2xl p-7 mb-6">
      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold tracking-[0.22em] uppercase text-glow-indigo mb-2">
            {eyebrow}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100 truncate">
            {niche.channelName ?? '—'}
          </h1>
          {niche.nicheLabel && (
            <p className="text-indigo-300 text-sm mt-1.5 truncate">{niche.nicheLabel}</p>
          )}
          <div className="flex items-center gap-3 mt-4">
            {niche.channelUrl && (
              <a
                href={niche.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${copy.detailVisitYouTube} (opens in new tab)`}
                className={[
                  // Real YouTube brand red — #FF0000. Solid fill is the
                  // canonical YouTube CTA treatment.
                  'inline-flex items-center gap-2',
                  'rounded-lg px-4 py-2 text-[13px] font-semibold',
                  'bg-[#FF0000] text-white',
                  // Hover: slight lift + soft red glow that matches the brand
                  // colour so the motion feels native, not synthetic.
                  'transition-all duration-150 ease-out',
                  'hover:-translate-y-[1px] hover:bg-[#E60000]',
                  'hover:shadow-[0_4px_18px_-4px_rgba(255,0,0,0.55)]',
                  'active:translate-y-0',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0000]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
                ].join(' ')}
              >
                <YoutubeLogo
                  weight="fill"
                  size={18}
                  aria-hidden
                  className="shrink-0"
                />
                <span>{copy.detailVisitYouTube}</span>
              </a>
            )}
            {/* Save niche — heart toggle. Sits beside the YouTube CTA so the
                two primary actions ("go look at the channel" / "keep this
                one") are paired. BookmarkButton enforces tier limits
                internally (free → upgrade tooltip, basic at 10/10 →
                premium tooltip) and short-circuits when any of the props
                isn't supplied. */}
            {userTier && onBookmarkToggle && (
              <BookmarkButton
                nicheId={niche.id}
                isSaved={isSaved ?? false}
                userTier={userTier}
                savedCount={savedCount ?? 0}
                onToggle={onBookmarkToggle}
              />
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-7xl font-extrabold leading-none tabular-nums ${tier.textClass} ${tier.glowShadow}`}>
            {niche.opportunityScore}
          </div>
          <div className="flex items-center justify-end gap-2 mt-2">
            <span className="text-slate-500 text-sm">/100</span>
            <span className={`text-[10px] font-semibold tracking-[0.22em] uppercase ${tier.textClass}`}>
              {tier.label}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
