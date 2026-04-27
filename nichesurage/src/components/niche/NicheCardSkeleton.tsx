export function NicheCardSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 animate-pulse">
      {/* Header row */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex-1">
          <div className="bg-slate-800 rounded h-2.5 w-14 mb-2" />
          <div className="bg-slate-800 rounded h-4 w-40" />
        </div>
        <div className="bg-slate-800 rounded-lg w-14 h-12" />
      </div>
      {/* Badge row */}
      <div className="flex gap-1.5 mb-3">
        <div className="bg-slate-800 rounded-full h-5 w-20" />
        <div className="bg-slate-800 rounded-full h-5 w-24" />
        <div className="bg-slate-800 rounded-full h-5 w-16" />
      </div>
      {/* Score bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-slate-800 rounded h-1.5" />
        <div className="bg-slate-800 rounded h-3.5 w-6" />
      </div>
    </div>
  )
}
