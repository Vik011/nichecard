import { fetchTopNiches } from '@/lib/landing/fetchTopNiches'
import { LandingPage } from '@/components/landing/LandingPage'

export const revalidate = 1800

export default async function Home() {
  const niches = await fetchTopNiches()
  return <LandingPage niches={niches} />
}
