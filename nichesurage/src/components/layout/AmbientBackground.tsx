import { NoiseOverlay } from './NoiseOverlay'

export function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div
        className="orb orb-emerald animate-orb-drift-1"
        style={{ top: '-10%', left: '-8%', width: '38vw', height: '38vw' }}
      />
      <div
        className="orb orb-deep animate-orb-drift-3"
        style={{ bottom: '-15%', left: '30%', width: '44vw', height: '44vw' }}
      />
      <NoiseOverlay />
    </div>
  )
}
