'use client'
import { useState } from 'react'
import type { NicheCardData } from '@/lib/types'
import type { Lang } from './copy'
import { COPY } from './copy'
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
import { NoiseOverlay } from './NoiseOverlay'

interface LandingPageProps {
  niches: NicheCardData[]
}

export function LandingPage({ niches }: LandingPageProps) {
  const [lang, setLang] = useState<Lang>('en')
  const copy = COPY[lang]

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <NoiseOverlay />
      <LandingNav copy={copy} lang={lang} onLangChange={setLang} />
      <HeroSection copy={copy} />
      <SocialProofBar copy={copy} />
      <AppPreviewSection niches={niches} copy={copy} />
      <PainSolutionSection copy={copy} />
      <FeaturesSection copy={copy} />
      <PricingSection copy={copy} />
      <TestimonialsSection copy={copy} />
      <FinalCTASection copy={copy} />
      <LandingFooter copy={copy} lang={lang} onLangChange={setLang} />
    </div>
  )
}
