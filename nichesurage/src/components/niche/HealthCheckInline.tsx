import type { UserTier } from '@/lib/types'
import type { CopyKeys } from '@/components/landing/copy'

interface HealthCheckInlineProps {
  scanResultId: string
  userTier: UserTier
  copy: CopyKeys
}

export function HealthCheckInline(_: HealthCheckInlineProps) {
  return <section data-testid="health-check-inline" />
}
