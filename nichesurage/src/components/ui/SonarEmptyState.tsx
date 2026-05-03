// SonarEmptyState — concentric rings + rotating sweep arm (sonar/radar visual).
// Used when /discover has no results to surface — turns the dead state into an
// "always-on radar" perception. Honors prefers-reduced-motion.

interface SonarEmptyStateProps {
  caption: string
  hint?: string
}

export function SonarEmptyState({ caption, hint }: SonarEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="relative w-40 h-40 mb-8">
        {/* Concentric rings */}
        <div className="absolute inset-0 rounded-full border border-glow-indigo/20" />
        <div className="absolute inset-4 rounded-full border border-glow-indigo/15" />
        <div className="absolute inset-8 rounded-full border border-glow-indigo/10" />

        {/* Sweep arm via conic-gradient mask */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-full animate-sonar-sweep motion-reduce:animate-none"
          style={{
            background:
              'conic-gradient(from 0deg, rgba(99,102,241,0) 0deg, rgba(99,102,241,0.35) 60deg, rgba(99,102,241,0) 120deg, rgba(99,102,241,0) 360deg)',
            maskImage: 'radial-gradient(circle, black 50%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(circle, black 50%, transparent 100%)',
          }}
        />

        {/* Static dots that ping at staggered intervals */}
        <span
          aria-hidden
          className="absolute top-[28%] left-[60%] w-1.5 h-1.5 rounded-full bg-glow-indigo animate-ping motion-reduce:animate-none"
          style={{ animationDelay: '0s' }}
        />
        <span
          aria-hidden
          className="absolute top-[62%] left-[34%] w-1.5 h-1.5 rounded-full bg-glow-cyan animate-ping motion-reduce:animate-none"
          style={{ animationDelay: '1.2s' }}
        />
        <span
          aria-hidden
          className="absolute top-[42%] left-[78%] w-1 h-1 rounded-full bg-glow-indigo/80 animate-ping motion-reduce:animate-none"
          style={{ animationDelay: '0.6s' }}
        />

        {/* Center pip */}
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-glow-indigo shadow-glow-indigo"
        />
      </div>

      <p className="text-slate-200 font-semibold tracking-tight">{caption}</p>
      {hint && <p className="text-slate-500 text-sm mt-2 max-w-md">{hint}</p>}
    </div>
  )
}
