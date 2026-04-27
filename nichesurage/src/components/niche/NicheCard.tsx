import { NicheCardData, UserTier, ViralityRating, ContentLanguage } from '@/lib/types'
import { LockedField } from './LockedField'
import { SpikeIndicator } from './SpikeIndicator'
import { ScoreBar } from './ScoreBar'

interface NicheCardProps {
  data: NicheCardData
  userTier: UserTier
  rank: number
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

export function NicheCard({ data, userTier, rank }: NicheCardProps) {
  const locked = userTier === 'free'

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      {/* Header row */}
      <div className="flex justify-between items-start mb-2.5">
        <div className="flex-1 min-w-0 mr-3">
          <div className="text-slate-400 text-xs uppercase tracking-widest mb-0.5">
            NICHE #{rank}
          </div>
          <div className="flex items-center gap-1.5">
            <LockedField locked={locked}>
              {data.channelName && data.channelUrl ? (
                <a
                  href={data.channelUrl}
                  className="text-slate-200 text-sm font-semibold hover:text-indigo-300 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {data.channelName} ↗
                </a>
              ) : (
                <span className="text-slate-200 text-sm font-semibold">—</span>
              )}
            </LockedField>
            {locked && <span className="text-xs text-slate-500">🔒</span>}
          </div>
          {data.nicheLabel && (
            <div className="text-indigo-400 text-xs mt-0.5">{data.nicheLabel}</div>
          )}
        </div>
        <SpikeIndicator multiplier={data.spikeMultiplier} />
      </div>

      {/* Badge row */}
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs">
          📺 {data.videoCount} videos
        </span>
        <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs">
          👥 {data.subscriberRange}
        </span>
        <LockedField locked={locked}>
          <span className={`bg-slate-800 px-2 py-0.5 rounded-full text-xs ${VIRALITY_STYLE[data.viralityRating]}`}>
            {VIRALITY_LABEL[data.viralityRating]}
          </span>
        </LockedField>
        {!locked && data.engagementRate !== undefined && (
          <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs">
            📈 {data.engagementRate}% eng
          </span>
        )}
        <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs">
          {LANG_FLAG[data.language]} {data.language.toUpperCase()}
        </span>
      </div>

      {/* Score bar */}
      <ScoreBar score={data.opportunityScore} />
    </div>
  )
}
