import type { NicheCardData } from '@/lib/types'

interface NicheCardProps {
  data: NicheCardData
  userTier: 'free' | 'basic' | 'pro'
  rank: number
}

export function NicheCard({ data, userTier, rank }: NicheCardProps) {
  return <div>NicheCard</div>
}
