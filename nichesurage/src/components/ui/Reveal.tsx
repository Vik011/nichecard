'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const reduce = useReducedMotion()
  const isMobile = useIsMobile()
  const useFade = reduce || isMobile

  if (reduce) {
    return <div className={className}>{children}</div>
  }

  const initial = useFade ? { opacity: 0 } : { opacity: 0, y: 20 }
  const whileInView = useFade ? { opacity: 1 } : { opacity: 1, y: 0 }
  const transition = useFade
    ? { duration: 0.15, delay }
    : { type: 'spring' as const, stiffness: 100, damping: 18, delay }

  return (
    <motion.div
      className={className}
      initial={initial}
      whileInView={whileInView}
      viewport={{ once: true, margin: '-80px' }}
      transition={transition}
    >
      {children}
    </motion.div>
  )
}
