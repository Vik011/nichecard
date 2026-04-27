import { ReactNode } from 'react'

interface LockedFieldProps {
  locked: boolean
  children: ReactNode
  className?: string
}

export function LockedField({ locked, children, className = '' }: LockedFieldProps) {
  if (!locked) return <>{children}</>
  return (
    <span
      style={{ filter: 'blur(5px)' }}
      title="Upgrade to Basic to unlock"
      className={`cursor-help select-none ${className}`}
    >
      {children}
    </span>
  )
}
