import type { NicheCardData } from '@/lib/types'
import type { CopyKeys } from '@/components/landing/copy'

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
}

export function NicheDetailHeader({ niche, copy }: NicheDetailHeaderProps) {
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
          {niche.channelUrl && (
            <a
              href={niche.channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 text-[13px] font-semibold px-4 py-2 rounded-lg gborder bg-charcoal-800/60 text-slate-200 hover:bg-charcoal-700/60 transition-colors"
            >
              {copy.detailVisitYouTube}
            </a>
          )}
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
