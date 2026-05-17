// src/components/dashboard/NicheCardLocked.tsx
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { NicheCardData } from '@/lib/types'

interface Props { card: NicheCardData }

const AVATAR_GRADIENTS = [
  'from-indigo-600 to-purple-700',
  'from-cyan-600 to-blue-700',
  'from-green-600 to-emerald-700',
  'from-pink-600 to-rose-700',
  'from-orange-600 to-amber-700',
]

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-400'
  if (score >= 60) return 'text-yellow-400'
  return 'text-ink-muted'
}

function scoreFill(score: number): string {
  if (score >= 80) return 'from-green-400 to-cyan-400'
  return 'from-yellow-400 to-orange-400'
}

export function NicheCardLocked({ card }: Props) {
  const gradient = AVATAR_GRADIENTS[parseInt(card.id, 36) % AVATAR_GRADIENTS.length]
  const isMega = card.spikeMultiplier >= 20

  return (
    <div className={`relative bg-[#0d1117] border rounded-2xl p-5 overflow-hidden transition-all hover:-translate-y-0.5 ${isMega ? 'border-orange-900/50 hover:border-orange-700/50' : 'border-hairline-edge'}`}>
      {/* Spike badge */}
      <div className={`absolute top-4 right-4 px-2 py-0.5 rounded-full text-xs font-bold ${isMega ? 'bg-orange-900/60 text-orange-300' : 'bg-orange-950/60 text-orange-400'}`}>
        {isMega ? '🔥' : '⚡'} {card.spikeMultiplier}x SPIKE
      </div>

      {/* Header — locked */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex-shrink-0`} />
        <div className="flex-1">
          <div className="h-3.5 bg-surface-elevated rounded w-3/4 mb-1.5 blur-sm" />
          <div className="h-2.5 bg-blue-950 rounded w-1/2 blur-sm" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-[#080d14] rounded-lg p-2 text-center">
          <div className="text-ink-subtle text-[9px] uppercase mb-1">Created</div>
          <div className="text-ink-muted text-xs font-semibold">
            {Math.round((Date.now() - new Date(card.channelCreatedAt).getTime()) / (1000 * 60 * 60 * 24 * 30))} mo ago
          </div>
        </div>
        <div className="bg-[#080d14] rounded-lg p-2 text-center">
          <div className="text-ink-subtle text-[9px] uppercase mb-1">Videos</div>
          <div className="text-ink-muted text-xs font-semibold">{card.videoCount}</div>
        </div>
        <div className="bg-[#080d14] rounded-lg p-2 text-center">
          <div className="text-ink-subtle text-[9px] uppercase mb-1">Virality</div>
          <div className={`text-xs font-semibold ${card.viralityRating === 'excellent' ? 'text-green-400' : card.viralityRating === 'good' ? 'text-yellow-400' : 'text-ink-muted'}`}>
            {card.viralityRating.charAt(0).toUpperCase() + card.viralityRating.slice(1)}
          </div>
        </div>
      </div>

      {/* Opportunity score */}
      <div className="bg-[#080d14] rounded-lg p-3 mb-3">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-ink-subtle text-[10px]">Opportunity Score</span>
          <span className={`text-sm font-bold ${scoreColor(card.opportunityScore)}`}>{card.opportunityScore}</span>
        </div>
        <div className="bg-surface-elevated rounded h-1">
          <div className={`bg-gradient-to-r ${scoreFill(card.opportunityScore)} h-full rounded`} style={{ width: `${card.opportunityScore}%` }} />
        </div>
      </div>

      {/* Subs range */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-ink-subtle text-xs">Subscribers</span>
        <span className="text-ink-subtle text-xs">{card.subscriberRange}</span>
      </div>

      {/* Lock CTA */}
      <div className="bg-gradient-to-br from-slate-900 to-purple-950/40 border border-indigo-900/50 rounded-xl p-3 text-center">
        <p className="text-indigo-400 text-[10px] mb-2">🔒 Channel name, niche &amp; link locked</p>
        <Button variant="primary" size="sm" className="w-full">
          Unlock for €9/mo →
        </Button>
      </div>
    </div>
  )
}
