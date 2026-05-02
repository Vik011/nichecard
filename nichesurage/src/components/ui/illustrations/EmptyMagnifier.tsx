export function EmptyMagnifier({ size = 96 }: { size?: number }) {
  const id = 'empty-magnifier-grad'
  const ringId = 'empty-magnifier-ring'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={id} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="rgb(99 102 241)" stopOpacity="0.45" />
          <stop offset="60%" stopColor="rgb(6 182 212)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="rgb(99 102 241)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ringId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgb(129 140 248)" />
          <stop offset="100%" stopColor="rgb(34 211 238)" />
        </linearGradient>
      </defs>

      {/* Soft brand-colored aura */}
      <circle cx="48" cy="44" r="40" fill={`url(#${id})`} />

      {/* Lens body */}
      <circle
        cx="42"
        cy="42"
        r="18"
        stroke={`url(#${ringId})`}
        strokeWidth="3"
        fill="rgba(14, 15, 22, 0.65)"
      />
      {/* Lens highlight */}
      <path
        d="M30 38 a14 14 0 0 1 8 -8"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Handle */}
      <line
        x1="56"
        y1="56"
        x2="74"
        y2="74"
        stroke={`url(#${ringId})`}
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Spark dots in cyan */}
      <circle cx="76" cy="22" r="2" fill="rgb(34 211 238)" opacity="0.85" />
      <circle cx="14" cy="60" r="1.5" fill="rgb(129 140 248)" opacity="0.7" />
      <circle cx="80" cy="46" r="1.25" fill="rgb(129 140 248)" opacity="0.55" />
    </svg>
  )
}
