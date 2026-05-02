import type { UserTier } from '@/lib/types'
import type { CopyKeys } from '@/components/landing/copy'

interface AIContentAnglesProps {
  scanResultId: string
  userTier: UserTier
  copy: CopyKeys
}

export function AIContentAngles(_: AIContentAnglesProps) {
  return <section data-testid="ai-content-angles" />
}
