import type { NicheCardData, ShortsNicheCardData, LongformNicheCardData, UserTier, ViralityRating, ContentLanguage, SpikePoint } from '@/lib/types'
import Link from 'next/link'
import { LockSimple } from '@phosphor-icons/react/dist/ssr'
import { LockedField } from './LockedField'
import { BookmarkButton } from './BookmarkButton'
import { HealthCheckButton } from './HealthCheckButton'
import { Sparkline, tierFromScore } from './Sparkline'
import { SpikingBadge } from './SpikingBadge'

const SPIKING_NOW_THRESHOLD = Number(process.env.NEXT_PUBLIC_SPIKING_NOW_THRESHOLD ?? '10')

interface NicheCardProps {
  data: NicheCardData
  userTier: UserTier
  rank: number
  isSaved?: boolean
  savedCount?: number
  spikeHistory?: SpikePoint[]
  fromUrl?: string
  onBookmarkToggle?: (id: string, saved: boolean) => void
}

const LANG_FLAG: Record<ContentLanguage, string> = { en: '🇬🇧', de: '🇩🇪' }

const VIRALITY_STYLE: Record<ViralityRating, string> = {
  excellent: 'text-green-400',
  good: 'text-yellow-400',
  average: 'text-slate-400',
}

const VIRALITY_LABEL: Record<ViralityRating, string> = {
  excellent: '✨ Excellent',
  good: '⭐ Good',
  average: '~ Average',
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

function ShortsMetrics({ data, locked }: { data: ShortsNicheCardData; locked: boolean }) {
  return (
    <>
      {!locked && data.avgViewDurationPct !== undefined && (
        <span className="bg-slate-800/70 text-indigo-300 px-2 py-0.5 rounded-full text-xs">
          ⏱ {data.avgViewDurationPct}% duration
        </span>
      )}
      {!locked && data.hookScore !== undefined && (
        <span className="bg-slate-800/70 text-indigo-300 px-2 py-0.5 rounded-full text-xs">
          🎣 hook {data.hookScore}
        </span>
      )}
    </>
  )
}

function LongformMetrics({ data, locked }: { data: LongformNicheCardData; locked: boolean }) {
  return (
    <>
      {!locked && data.searchVolume !== undefined && (
        <span className="bg-slate-800/70 text-blue-300 px-2 py-0.5 rounded-full text-xs">
          🔍 {formatK(data.searchVolume)} searches
        </span>
      )}
      {!locked && data.competitionScore !== undefined && (
        <span className="bg-slate-800/70 text-orange-300 px-2 py-0.5 rounded-full text-xs">
          ⚔️ {data.competitionScore}% comp
        </span>
      )}
      {!locked && data.avgViewsPerVideo !== undefined && (
        <span className="bg-slate-800/70 text-slate-300 px-2 py-0.5 rounded-full text-xs">
          👁 {formatK(data.avgViewsPerVideo)} views/video
        </span>
      )}
    </>
  )
}

export function NicheCard({ data, userTier, rank, isSaved, savedCount, spikeHistory, fromUrl, onBookmarkToggle }: NicheCardProps) {
  const locked = userTier === 'free'
  const tier = scoreTier(data.opportunityScore)
  const isHero = rank <= 3
  const detailHref = fromUrl
    ? `/discover/niche/${data.id}?from=${encodeURIComponent(fromUrl)}`
    : `/discover/niche/${data.id}`

  return (
    <Link
      href={detailHref}
      aria-label={`Open detail page for ${data.channelName ?? 'this niche'}`}
      className={`glass ${isHero ? 'glass-glow' : ''} rounded-xl p-4 block transition-all duration-200 hover:scale-[1.02] hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-glow-indigo/60`}
    >
      {/* Header: rank label + actions */}
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-slate-500 text-[10px] uppercase tracking-[0.18em] font-semibold shrink-0">
            Niche #{rank}
          </div>
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

      {/* Badge row */}
      <div className="flex flex-wrap gap-1.5">
        <span className="bg-slate-800/70 text-slate-300 px-2 py-0.5 rounded-full text-xs">
          📺 {data.videoCount} videos
        </span>
        <span className="bg-slate-800/70 text-slate-300 px-2 py-0.5 rounded-full text-xs">
          👥 {data.subscriberRange}
        </span>
        <LockedField locked={locked}>
          <span className={`bg-slate-800/70 px-2 py-0.5 rounded-full text-xs ${VIRALITY_STYLE[data.viralityRating]}`}>
            {VIRALITY_LABEL[data.viralityRating]}
          </span>
        </LockedField>
        <span className="bg-slate-800/70 text-slate-300 px-2 py-0.5 rounded-full text-xs">
          {LANG_FLAG[data.language]} {data.language.toUpperCase()}
        </span>
        <span className="bg-orange-950/60 text-orange-300 px-2 py-0.5 rounded-full text-xs font-semibold">
          ⚡ {data.spikeMultiplier}×
        </span>
        {data.trending && (
          <span className="bg-orange-950/60 text-orange-300 px-2 py-0.5 rounded-full text-xs font-semibold">
            🔥 Trending
          </span>
        )}
        {!locked && data.engagementRate !== undefined && (
          <span className="bg-slate-800/70 text-slate-300 px-2 py-0.5 rounded-full text-xs">
            📈 {data.engagementRate}% eng
          </span>
        )}
        {data.contentType === 'shorts'
          ? <ShortsMetrics data={data} locked={locked} />
          : <LongformMetrics data={data} locked={locked} />
        }
      </div>
    </Link>
  )
}
