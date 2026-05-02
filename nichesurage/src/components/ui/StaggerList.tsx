'use client'

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'
import { Children, type ReactNode } from 'react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

interface StaggerListProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode
  stagger?: number
  itemDelay?: number
}

const containerVariants = (stagger: number, itemDelay: number) => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren: itemDelay },
  },
})

const springItemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 18 },
  },
}

const fadeItemVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
}

export function StaggerList({
  children,
  stagger = 0.05,
  itemDelay = 0,
  className,
  ...rest
}: StaggerListProps) {
  const reduce = useReducedMotion()
  const isMobile = useIsMobile()
  const useFade = reduce || isMobile
  const variants = useFade ? fadeItemVariants : springItemVariants
  const effectiveStagger = useFade ? Math.min(stagger, 0.025) : stagger

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={containerVariants(effectiveStagger, itemDelay)}
      {...rest}
    >
      {Children.map(children, (child, i) => (
        <motion.div key={i} variants={variants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}
