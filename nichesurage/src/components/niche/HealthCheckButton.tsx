'use client'

import { Heartbeat } from '@phosphor-icons/react/dist/ssr'
import { useState } from 'react'
import { canUseAIFeatures } from '@/lib/tier'
import type { UserTier } from '@/lib/types'
import { HealthCheckModal } from './HealthCheckModal'

interface HealthCheckButtonProps {
  scanResultId: string
  nicheLabel: string
  userTier: UserTier
}

export function HealthCheckButton({ scanResultId, nicheLabel, userTier }: HealthCheckButtonProps) {
  const [open, setOpen] = useState(false)
  const allowed = canUseAIFeatures(userTier)

  if (!allowed) {
    return (
      <button
        type="button"
        aria-disabled="true"
        title="Premium feature"
        className="text-slate-600 opacity-60 p-1.5 rounded-lg cursor-not-allowed"
      >
        <Heartbeat weight="duotone" size={18} aria-hidden />
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Health check for ${nicheLabel}`}
        className="text-glow-violet hover:brightness-110 p-1.5 rounded-lg transition-all"
      >
        <Heartbeat weight="duotone" size={18} aria-hidden />
      </button>
      {open && (
        <HealthCheckModal
          scanResultId={scanResultId}
          nicheLabel={nicheLabel}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
