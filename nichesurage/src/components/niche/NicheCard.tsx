import type { NicheCardData, ShortsNicheCardData, LongformNicheCardData, UserTier, ViralityRating, ContentLanguage, SpikePoint, TrendData } from '@/lib/types'
import Link from 'next/link'
import {
  LockSimple,
  Television,
  UsersThree,
  Lightning,
  Flame,
  TrendUp,
  MagnifyingGlass,
  Sword,
  Eye,
  Clock,
  Target,
  Sparkle,
  Star,
  Minus,
} from '@phosphor-icons/react/dist/ssr'
import { LockedField } from './LockedField'
import { BookmarkButton } from './BookmarkButton'
import { HealthCheckButton } from './HealthCheckButton'
import { Sparkline, tierFromScore } from './Sparkline'
import { SpikingBadge } from './SpikingBadge'
import { TrendBadge } from './TrendBadge'
import { ContentTypeBadge } from './ContentTypeBadge'

const SPIKING_NOW_THRESHOLD = Number(process.env.NEXT_PUBLIC_SPIKING_NOW_THRESHOLD ?? '10')

interface NicheCardProps {
  data: NicheCardData
  userTier: UserTier
  rank: number
  /**
   * Sprint A.7: parent decides whether this card is unlocked based on
   * tier + reveal logic (see lib/tier/reveal.ts). When false, the card
   * renders as a button (not a Link) and clicking it triggers
   * onLockedClick instead of navigating to the detail page. The blur +
   * lock-icon visuals also key off this prop.
   *
   * Backwards compat: defaults to true so any caller that hasn't migrated
   * still gets the old "fully unlocked" behavior. Migrate callers ASAP.
   */
  revealed?: boolean
  onLockedClick?: () => void
  isSaved?: boolean
  savedCount?: number
  spikeHistory?: SpikePoint[]
  fromUrl?: string
  onBookmarkToggle?: (id: string, saved: boolean) => void
  /**
   * Sprint B Phase 7A: optional trend overlay (lifecycle, cluster size,
   * archetype). When omitted, no TrendBadge renders. The badge itself
   * silently no-ops if both score and cluster are below threshold, so it's
   * safe to pass partial/empty data.
   */
  trendData?: TrendData
}

// Country flag remains as Unicode (regional indicator pair). Native
// browser/OS rendering is consistent enough and pure-text alternatives
// ("EN", "DE") lose recognizability. Phosphor doesn't ship country
// flags so SVG-replacement would mean adding an icon library.
const LANG_FLAG: Record<ContentLanguage, string> = { en: '🇬🇧', de: '🇩🇪' }

const VIRALITY_STYLE: Record<ViralityRating, string> = {
  excellent: 'text-green-400',
  good: 'text-yellow-400',
  average: 'text-slate-400',
}

const VIRALITY_LABEL: Record<ViralityRating, string> = {
  excellent: 'Excellent',
  good: 'Good',
  average: 'Average',
}

// Phosphor icon map per virality rating (replaces emoji prefixes ✨ ⭐ ~).
const VIRALITY_ICON: Record<ViralityRating, typeof Sparkle> = {
  excellent: Sparkle,
  good: Star,
  average: Minus,
}

function formatK(n: number): string {
  if (n >= 1000) return `${parseFloat((n / 1000).toFixed(1))}k`
  return String(n)
}

interface ScoreTier {
  textClass: string
  glowShadow: string
  label: string
}

function scoreTier(score: number): ScoreTier {
  if (score >= 70) return {
    textClass: 'text-emerald-400',
    glowShadow: 'drop-shadow-[0_0_18px_rgba(52,211,153,0.55)]',
    label: 'EXCELLENT',
  }
  if (score >= 50) return {
    textClass: 'text-indigo-300',
    glowShadow: 'drop-shadow-[0_0_18px_rgba(167,139,250,0.55)]',
    label: 'STRONG',
  }
  return {
    textClass: 'text-slate-300',
    glowShadow: 'drop-shadow-[0_0_12px_rgba(148,163,184,0.30)]',
    label: 'AVERAGE',
  }
}

// Shared chip styling — pulled out so every metric chip on the card has
// matching height, padding, gap, and rounded radius. Type variants
// (data colour, icon colour) are applied via additional classes per chip.
const CHIP_BASE =
  'inline-flex items-center gap-1 bg-slate-800/70 px-2 py-0.5 rounded-full text-xs'
const CHIP_ICON_SIZE = 11

function ShortsMetrics({ data, locked }: { data: ShortsNicheCardData; locked: boolean }) {
  return (
    <>
      {!locked && data.avgViewDurationPct !== undefined && (
        <span className={`${CHIP_BASE} text-indigo-300`}>
          <Clock size={CHIP_ICON_SIZE} weight="bold" aria-hidden />
          {data.avgViewDurationPct}% duration
        </span>
      )}
      {!locked && data.hookScore !== undefined && (
        <span className={`${CHIP_BASE} text-indigo-300`}>
          <Target size={CHIP_ICON_SIZE} weight="bold" aria-hidden />
          hook {data.hookScore}
        </span>
      )}
    </>
  )
}

function LongformMetrics({ data, locked }: { data: LongformNicheCardData; locked: boolean }) {
  return (
    <>
      {!locked && data.searchVolume !== undefined && (
        <span className={`${CHIP_BASE} text-blue-300`}>
          <MagnifyingGlass size={CHIP_ICON_SIZE} weight="bold" aria-hidden />
          {formatK(data.searchVolume)} searches
        </span>
      )}
      {!locked && data.competitionScore !== undefined && (
        <span className={`${CHIP_BASE} text-orange-300`}>
          <Sword size={CHIP_ICON_SIZE} weight="bold" aria-hidden />
          {data.competitionScore}% comp
        </span>
      )}
      {!locked && data.avgViewsPerVideo !== undefined && (
        <span className={`${CHIP_BASE} text-slate-300`}>
          <Eye size={CHIP_ICON_SIZE} weight="bold" aria-hidden />
          {formatK(data.avgViewsPerVideo)} views/video
        </span>
      )}
    </>
  )
}

export function NicheCard({
  data,
  userTier,
  rank,
  revealed = true,
  onLockedClick,
  isSaved,
  savedCount,
  spikeHistory,
  fromUrl,
  onBookmarkToggle,
  trendData,
}: NicheCardProps) {
  const locked = !revealed
  const tier = scoreTier(data.opportunityScore)
  const isHero = rank <= 3
  const detailHref = fromUrl
    ? `/discover/niche/${data.id}?from=${encodeURIComponent(fromUrl)}`
    : `/discover/niche/${data.id}`

  // Wrap-element: real Link when the card is unlocked (full nav), and a
  // button when locked so clicks raise an upsell modal instead of leaking
  // through to the detail page. Same outer styling so the visual swap is
  // invisible.
  //
  // Hover: subtle 2px lift + indigo-tinted soft glow (was scale[1.02] +
  // brightness[110] which read as harsh and animated layout). transition
  // is now scoped to transform + box-shadow only — no `transition-all`
  // since it would also animate text colour shifts and incur layout work.
  const wrapperClass = [
    'glass',
    isHero ? 'glass-glow' : '',
    'rounded-xl p-4 block w-full text-left',
    'transition-[transform,box-shadow] duration-200 ease-out',
    'hover:-translate-y-[2px] hover:shadow-[0_10px_28px_-14px_rgba(99,102,241,0.55)]',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-glow-indigo/60',
  ].filter(Boolean).join(' ')

  const cardBody = (
    <>
      {/* Header: rank label + format badge + actions */}
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-slate-500 text-[10px] uppercase tracking-[0.18em] font-semibold shrink-0">
            Niche #{rank}
          </div>
          <ContentTypeBadge type={data.contentType} />
          {(data.outlierRatio ?? 0) >= SPIKING_NOW_THRESHOLD && <SpikingBadge />}
        </div>
        <div className="flex items-center gap-0.5 -mt-1 -mr-1">
          <HealthCheckButton
            scanResultId={data.id}
            nicheLabel={data.nicheLabel ?? 'this niche'}
            userTier={userTier}
          />
          {onBookmarkToggle && (
            <BookmarkButton
              nicheId={data.id}
              isSaved={isSaved ?? false}
              userTier={userTier}
              savedCount={savedCount ?? 0}
              onToggle={onBookmarkToggle}
            />
          )}
        </div>
      </div>

      {/* Hero row: channel name + niche label on left, big glowing score on right */}
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <LockedField locked={locked}>
              <span className="text-slate-100 text-base font-bold block truncate">
                {data.channelName ?? '—'}
              </span>
            </LockedField>
            {locked && (
              <LockSimple
                weight="fill"
                size={12}
                className="text-slate-500 shrink-0"
                aria-label="Locked"
              />
            )}
          </div>
          {data.nicheLabel && (
            <div className="text-indigo-300 text-xs mt-0.5 truncate">{data.nicheLabel}</div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-4xl font-extrabold leading-none tabular-nums ${tier.textClass} ${tier.glowShadow}`}>
            {data.opportunityScore}
          </div>
          <div className="text-slate-500 text-[9px] uppercase tracking-[0.18em] font-semibold mt-1">
            {tier.label}
          </div>
          {data.outlierRatio !== undefined && (
            <div className="mt-1 text-glow-cyan text-xs font-semibold">
              {data.outlierRatio.toFixed(1)}× outlier
            </div>
          )}
          <div className="mt-2 flex justify-end">
            <Sparkline
              data={spikeHistory ?? []}
              variant="card"
              tier={tierFromScore(data.opportunityScore)}
            />
          </div>
        </div>
      </div>

      {/* Trend overlay (Sprint B Phase 7A) — renders only when score or
          cluster size crosses threshold; silently null otherwise. */}
      {trendData && (
        <div className="mb-2">
          <TrendBadge data={trendData} />
        </div>
      )}

      {/* Badge row */}
      <div className="flex flex-wrap gap-1.5">
        <span className={`${CHIP_BASE} text-slate-300`}>
          <Television size={CHIP_ICON_SIZE} weight="bold" aria-hidden />
          {data.videoCount} videos
        </span>
        <span className={`${CHIP_BASE} text-slate-300`}>
          <UsersThree size={CHIP_ICON_SIZE} weight="bold" aria-hidden />
          {data.subscriberRange}
        </span>
        <LockedField locked={locked}>
          <span className={`${CHIP_BASE} ${VIRALITY_STYLE[data.viralityRating]}`}>
            {(() => {
              const ViralityIcon = VIRALITY_ICON[data.viralityRating]
              return <ViralityIcon size={CHIP_ICON_SIZE} weight="fill" aria-hidden />
            })()}
            {VIRALITY_LABEL[data.viralityRating]}
          </span>
        </LockedField>
        <span className={`${CHIP_BASE} text-slate-300`}>
          <span aria-hidden className="leading-none text-[11px]">
            {LANG_FLAG[data.language]}
          </span>
          {data.language.toUpperCase()}
        </span>
        <span className="inline-flex items-center gap-1 bg-orange-950/60 text-orange-300 px-2 py-0.5 rounded-full text-xs font-semibold">
          <Lightning size={CHIP_ICON_SIZE} weight="fill" aria-hidden />
          {data.spikeMultiplier}×
        </span>
        {data.trending && (
          <span className="inline-flex items-center gap-1 bg-orange-950/60 text-orange-300 px-2 py-0.5 rounded-full text-xs font-semibold">
            <Flame size={CHIP_ICON_SIZE} weight="fill" aria-hidden />
            Trending
          </span>
        )}
        {!locked && data.engagementRate !== undefined && (
          <span className={`${CHIP_BASE} text-slate-300`}>
            <TrendUp size={CHIP_ICON_SIZE} weight="bold" aria-hidden />
            {data.engagementRate}% eng
          </span>
        )}
        {data.contentType === 'shorts'
          ? <ShortsMetrics data={data} locked={locked} />
          : <LongformMetrics data={data} locked={locked} />
        }
      </div>
    </>
  )

  if (locked) {
    return (
      <button
        type="button"
        onClick={onLockedClick}
        aria-label={`Locked niche — upgrade to unlock`}
        className={wrapperClass}
      >
        {cardBody}
      </button>
    )
  }
  return (
    <Link
      href={detailHref}
      aria-label={`Open detail page for ${data.channelName ?? 'this niche'}`}
      className={wrapperClass}
    >
      {cardBody}
    </Link>
  )
}
