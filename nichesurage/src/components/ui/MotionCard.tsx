'use client'

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef } from 'react'

type MotionCardProps = HTMLMotionProps<'div'> & {
  hoverScale?: number
}

const SPRING = { type: 'spring' as const, stiffness: 100, damping: 18 }

export const MotionCard = forwardRef<HTMLDivElement, MotionCardProps>(
  function MotionCard({ hoverScale = 1.02, children, ...rest }, ref) {
    const reduce = useReducedMotion()
    return (
      <motion.div
        ref={ref}
        whileHover={reduce ? undefined : { scale: hoverScale }}
        transition={reduce ? { duration: 0.001 } : SPRING}
        {...rest}
      >
        {children}
      </motion.div>
    )
  }
)
