'use client'

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface EmptyStateProps {
  illustration: ReactNode
  title: string
  body: string
  cta?: {
    label: string
    onClick?: () => void
    href?: string
  }
}

export function EmptyState({ illustration, title, body, cta }: EmptyStateProps) {
  const reduce = useReducedMotion()
  const initial = reduce ? { opacity: 0 } : { opacity: 0, y: 8 }
  const animate = reduce ? { opacity: 1 } : { opacity: 1, y: 0 }
  const transition = reduce
    ? { duration: 0.15 }
    : { type: 'spring' as const, stiffness: 100, damping: 18 }

  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={transition}
      className="max-w-md mx-auto py-6"
    >
      <div className="glass glass-glow rounded-2xl p-8 text-center">
        <div className="flex justify-center mb-5">{illustration}</div>
        <h3 className="text-slate-100 text-base font-semibold mb-1.5">{title}</h3>
        <p className="text-slate-500 text-sm leading-relaxed mb-5">{body}</p>
        {cta && (
          cta.href ? (
            <a
              href={cta.href}
              className="inline-block text-[13px] font-semibold px-4 py-2 rounded-lg gborder bg-charcoal-800/60 text-slate-200 hover:bg-charcoal-700/60 transition-colors"
            >
              {cta.label}
            </a>
          ) : (
            <button
              type="button"
              onClick={cta.onClick}
              className="text-[13px] font-semibold px-4 py-2 rounded-lg gborder bg-charcoal-800/60 text-slate-200 hover:bg-charcoal-700/60 transition-colors"
            >
              {cta.label}
            </button>
          )
        )}
      </div>
    </motion.div>
  )
}
