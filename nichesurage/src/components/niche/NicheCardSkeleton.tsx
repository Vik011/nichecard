export function NicheCardSkeleton() {
  return (
    <div className="glass rounded-xl p-4 animate-pulse">
      {/* Header row: rank + actions */}
      <div className="flex justify-between items-start mb-1">
        <div className="bg-slate-800 rounded h-2.5 w-14" />
        <div className="flex gap-1">
          <div className="bg-slate-800 rounded w-6 h-6" />
          <div className="bg-slate-800 rounded w-6 h-6" />
        </div>
      </div>

      {/* Hero row: channel/niche + score */}
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="flex-1 space-y-2 pt-1">
          <div className="bg-slate-800 rounded h-4 w-3/4" />
          <div className="bg-slate-800 rounded h-3 w-1/2" />
        </div>
        <div className="bg-slate-800 rounded w-12 h-10" />
      </div>

      {/* Badge row */}
      <div className="flex flex-wrap gap-1.5">
        <div className="bg-slate-800 rounded-full h-5 w-20" />
        <div className="bg-slate-800 rounded-full h-5 w-24" />
        <div className="bg-slate-800 rounded-full h-5 w-16" />
        <div className="bg-slate-800 rounded-full h-5 w-12" />
      </div>
    </div>
  )
}
