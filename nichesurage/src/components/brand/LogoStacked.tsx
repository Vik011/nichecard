import { Logo } from './Logo'

type LogoStackedProps = {
  /** Icon size in px. Wordmark scales as a function of this (22%, min 11px). */
  iconSize?: number
  className?: string
}

/**
 * Stacked logo lockup — icon dominant, "SurgeNiche" wordmark below.
 *
 * Use for surfaces where the brand needs to feel like a "monument": login
 * page, footer, sign-up modals, OG share image, marketing posters. Do NOT
 * use in horizontal nav bars (TopNav / LandingNav already use the
 * horizontal lockup; they're tighter on vertical space).
 *
 * Wordmark is CamelCase ("SurgeNiche") to preserve the two-word semantic
 * (Surge + Niche), not lowercase. Geist Sans bold by default — picks up
 * the project's font-sans Tailwind family.
 */
export function LogoStacked({ iconSize = 64, className }: LogoStackedProps) {
  // Scale wordmark to roughly 22% of the icon. Floor at 11px so the small
  // header / footer use cases stay readable.
  const wordmarkPx = Math.max(11, Math.round(iconSize * 0.22))
  // Tighter gap as size shrinks; scales gently with icon.
  const gapPx = Math.max(6, Math.round(iconSize * 0.16))

  return (
    <div
      className={`inline-flex flex-col items-center ${className ?? ''}`}
      style={{ gap: `${gapPx}px` }}
    >
      <Logo size={iconSize} className="text-white" />
      <span
        className="font-bold tracking-tight text-white"
        style={{ fontSize: `${wordmarkPx}px`, letterSpacing: '-0.01em' }}
      >
        SurgeNiche
      </span>
    </div>
  )
}
