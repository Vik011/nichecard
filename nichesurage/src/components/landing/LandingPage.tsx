'use client'
import type { NicheCardData } from '@/lib/types'
import type { RadarSnapshot } from '@/lib/landing/fetchRadarPings'
import { COPY } from './copy'
import { useLang } from '@/lib/i18n/useLang'
import { useUser } from '@/lib/context/UserContext'
import { LandingNav } from './LandingNav'
import { LiveTickerBar } from './LiveTickerBar'
import { HeroSection } from './HeroSection'
import { AppPreviewSection } from './AppPreviewSection'
import { PainSolutionSection } from './PainSolutionSection'
import { FeaturesSection } from './FeaturesSection'
import { PricingSection } from './PricingSection'
import { TierMatrix } from './TierMatrix'
import { FaqSection } from './FaqSection'
// TestimonialsSection is intentionally NOT mounted on the landing page —
// the placeholder quotes read like AI-generated marketing copy and savvy
// visitors smell that out, which hurts trust more than fake social proof
// helps. The component + copy.ts entries are kept so we can re-mount once
// we have real testimonials from the founder's 25k-member Discord
// community of YouTube creators (which the founder has already started
// soliciting). Until then, the landing flow goes:
// Hero → AppPreview → PainSolution → Features → Pricing → TierMatrix → FAQ → FinalCTA.
// import { TestimonialsSection } from './TestimonialsSection'
import { FinalCTASection } from './FinalCTASection'
import { LandingFooter } from './LandingFooter'
import { Reveal } from '@/components/ui/Reveal'

interface LandingPageProps {
  niches: NicheCardData[]
  radar: RadarSnapshot
}

export function LandingPage({ niches, radar }: LandingPageProps) {
  const [lang, setLang] = useLang()
  const copy = COPY[lang]
  const { isLoggedIn } = useUser()

  return (
    <div className="relative min-h-screen text-ink">
      <LandingNav copy={copy} lang={lang} onLangChange={setLang} />
      <LiveTickerBar
        copy={copy}
        spikedLastHour={47}
        nichesSurfacedToday={radar.channelsLast24h}
      />
      <HeroSection copy={copy} isLoggedIn={isLoggedIn} radar={radar} />
      <Reveal><AppPreviewSection niches={niches} copy={copy} isLoggedIn={isLoggedIn} /></Reveal>
      <Reveal><PainSolutionSection copy={copy} /></Reveal>
      <Reveal><FeaturesSection copy={copy} /></Reveal>
      <Reveal><PricingSection copy={copy} /></Reveal>
      <Reveal><TierMatrix copy={copy} /></Reveal>
      <Reveal><FaqSection copy={copy} /></Reveal>
      {/* <Reveal><TestimonialsSection copy={copy} /></Reveal> — see import comment */}
      <Reveal><FinalCTASection copy={copy} isLoggedIn={isLoggedIn} /></Reveal>
      <LandingFooter copy={copy} lang={lang} onLangChange={setLang} />
    </div>
  )
}
