interface ScoreBarProps {
  score: number
}

export function ScoreBar({ score }: ScoreBarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-800 rounded h-1.5">
        <div
          className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded"
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-purple-400 text-xs font-bold">{score}</span>
      <span className="text-slate-500 text-xs">score</span>
    </div>
  )
}
