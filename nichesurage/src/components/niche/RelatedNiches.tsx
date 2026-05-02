import type { NicheCardData, UserTier } from '@/lib/types'
import type { CopyKeys } from '@/components/landing/copy'

interface RelatedNichesProps {
  niche: NicheCardData
  userTier: UserTier
  copy: CopyKeys
}

export function RelatedNiches(_: RelatedNichesProps) {
  return <section data-testid="related-niches" />
}
