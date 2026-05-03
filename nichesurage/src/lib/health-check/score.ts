export interface ScoreInput {
  spike_multiplier: number | null
  opportunity_score: number | null
  engagement_rate: number | null
  virality_rating: 'excellent' | 'good' | 'average' | null
  subscriber_count: number | null
  views_48h: number | null
}

export interface ScoreComponents {
  spike: number       // 0–25
  opportunity: number // 0–25
  engagement: number  // 0–20
  virality: number    // 0–15
  saturation: number  // 0–15 (inverse of subscriber size)
}

export interface ScoreResult {
  score: number
  components: ScoreComponents
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

export function computeHealthScore(i: ScoreInput): ScoreResult {
  const spike = clamp(((i.spike_multiplier ?? 1) - 1) / 9, 0, 1) * 25
  const opportunity = clamp((i.opportunity_score ?? 0) / 100, 0, 1) * 25
  const engagement = clamp((i.engagement_rate ?? 0) / 0.15, 0, 1) * 20
  const virality =
    i.virality_rating === 'excellent' ? 15 :
    i.virality_rating === 'good' ? 10 :
    i.virality_rating === 'average' ? 5 : 0
  const subs = i.subscriber_count ?? 0
  const saturation =
    subs <= 1_000 ? 15 :
    subs <= 10_000 ? 12 :
    subs <= 50_000 ? 8 :
    subs <= 200_000 ? 4 : 0

  const raw = spike + opportunity + engagement + virality + saturation
  return {
    score: clamp(Math.round(raw), 0, 100),
    components: { spike, opportunity, engagement, virality, saturation },
  }
}
