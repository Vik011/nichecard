export function NoiseOverlay({ opacity = 0.02 }: { opacity?: number }) {
  return (
    <div
      aria-hidden="true"
      className="noise-overlay pointer-events-none fixed inset-0 z-[1] mix-blend-overlay"
      style={{ opacity }}
    />
  )
}
