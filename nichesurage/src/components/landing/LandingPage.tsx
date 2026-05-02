'use client'
import type { NicheCardData } from '@/lib/types'
import { COPY } from './copy'
import { useLang } from '@/lib/i18n/useLang'
import { useUser } from '@/lib/context/UserContext'
import { LandingNav } from './LandingNav'
import { HeroSection } from './HeroSection'
import { SocialProofBar } from './SocialProofBar'
import { AppPreviewSection } from './AppPreviewSection'
import { PainSolutionSection } from './PainSolutionSection'
import { FeaturesSection } from './FeaturesSection'
import { PricingSection } from './PricingSection'
import { TestimonialsSection } from './TestimonialsSection'
import { FinalCTASection } from './FinalCTASection'
import { LandingFooter } from './LandingFooter'
import { Reveal } from '@/components/ui/Reveal'

interface LandingPageProps {
  niches: NicheCardData[]
}

export function LandingPage({ niches }: LandingPageProps) {
  const [lang, setLang] = useLang()
  const copy = COPY[lang]
  const { isLoggedIn } = useUser()

  return (
    <div className="relative min-h-screen text-slate-100">
      <LandingNav copy={copy} lang={lang} onLangChange={setLang} />
      <HeroSection copy={copy} isLoggedIn={isLoggedIn} />
      <SocialProofBar copy={copy} />
      <Reveal><AppPreviewSection niches={niches} copy={copy} isLoggedIn={isLoggedIn} /></Reveal>
      <Reveal><PainSolutionSection copy={copy} /></Reveal>
      <Reveal><FeaturesSection copy={copy} /></Reveal>
      <Reveal><PricingSection copy={copy} /></Reveal>
      <Reveal><TestimonialsSection copy={copy} /></Reveal>
      <Reveal><FinalCTASection copy={copy} isLoggedIn={isLoggedIn} /></Reveal>
      <LandingFooter copy={copy} lang={lang} onLangChange={setLang} />
    </div>
  )
}
