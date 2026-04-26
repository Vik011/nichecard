interface BadgeProps {
  children: React.ReactNode
  variant?: 'tier-free' | 'tier-basic' | 'tier-premium' | 'spike' | 'spike-mega' | 'virality-excellent' | 'virality-good' | 'virality-average' | 'lang'
  className?: string
}

export function Badge({ children, variant = 'lang', className = '' }: BadgeProps) {
  const variants = {
    'tier-free': 'bg-slate-800 text-slate-400 border border-slate-700',
    'tier-basic': 'bg-blue-950 text-blue-400 border border-blue-800',
    'tier-premium': 'bg-purple-950 text-purple-400 border border-purple-800',
    'spike': 'bg-orange-950 text-orange-400 font-bold',
    'spike-mega': 'bg-orange-900 text-orange-300 font-bold',
    'virality-excellent': 'bg-transparent text-green-400',
    'virality-good': 'bg-transparent text-yellow-400',
    'virality-average': 'bg-transparent text-slate-400',
    'lang': 'bg-slate-800 text-slate-500',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
