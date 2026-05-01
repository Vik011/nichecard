import { TopNav } from '@/components/nav/TopNav'

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {children}
    </>
  )
}
