interface SpikeIndicatorProps {
  multiplier: number
}

export function SpikeIndicator({ multiplier }: SpikeIndicatorProps) {
  if (multiplier >= 5) {
    return (
      <div className="bg-orange-950 border border-orange-700 rounded-lg p-2 text-right">
        <div className="text-orange-400 text-2xl font-extrabold tracking-tight">{multiplier}×</div>
        <div className="text-orange-400 text-xs uppercase tracking-wide">MEGA</div>
      </div>
    )
  }
  return (
    <div className="text-right">
      <div className="text-orange-400 text-xl font-bold">{multiplier}×</div>
      <div className="text-slate-500 text-xs uppercase tracking-wide">spike</div>
    </div>
  )
}
