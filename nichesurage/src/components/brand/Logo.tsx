import type { SVGProps } from 'react'

type LogoProps = SVGProps<SVGSVGElement> & {
  size?: number
}

/**
 * SurgeNiche logomark — concentric crosshair target with emerald center dot.
 * Uses `currentColor` for the rings and crosshair lines so the parent's text
 * color drives them (white on dark headers, slate-700 on light email bodies).
 * The emerald `#34d399` center is hard-coded — same brand accent used for
 * Premium tier ring + Live indicator pulse, so it stays constant.
 */
export function Logo({ size = 32, className, ...rest }: LogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="SurgeNiche"
      {...rest}
    >
      <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="3"/>
      <circle cx="32" cy="32" r="14" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.5"/>
      <circle cx="32" cy="32" r="5" fill="#34d399"/>
      <line x1="32" y1="2" x2="32" y2="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <line x1="32" y1="54" x2="32" y2="62" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <line x1="2" y1="32" x2="10" y2="32" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <line x1="54" y1="32" x2="62" y2="32" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}
