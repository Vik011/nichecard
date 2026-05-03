import { Suspense } from 'react'
import { TopNav } from '@/components/nav/TopNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<div className="h-14 border-b border-slate-800/60" aria-hidden />}>
        <TopNav />
      </Suspense>
      {children}
    </>
  )
}
