import { fetchTopNiches } from '@/lib/landing/fetchTopNiches'
import { fetchRadarPings } from '@/lib/landing/fetchRadarPings'
import { LandingPage } from '@/components/landing/LandingPage'

export const revalidate = 1800

export default async function Home() {
  const [niches, radar] = await Promise.all([
    fetchTopNiches(),
    fetchRadarPings(),
  ])
  return <LandingPage niches={niches} radar={radar} />
}
