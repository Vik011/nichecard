'use client'

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'
import { Children, type ReactNode } from 'react'

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

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 18 },
  },
}

const reducedItemVariants = {
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
  const variants = reduce ? reducedItemVariants : itemVariants
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={containerVariants(reduce ? 0.02 : stagger, itemDelay)}
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
