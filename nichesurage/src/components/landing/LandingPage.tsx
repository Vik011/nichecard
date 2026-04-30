'use client'
import { useState } from 'react'
import type { NicheCardData } from '@/lib/types'
import type { Lang } from './copy'
import { COPY } from './copy'

// Section components — created in Tasks 4–9
// Using inline stubs until those tasks complete.
// LandingNav and LandingFooter receive lang+onLangChange so they can render <LanguageToggle> from ./LanguageToggle.
function LandingNav(_props: { copy: Record<string, unknown>; lang: Lang; onLangChange: (l: Lang) => void }) { return null }
function HeroSection(_props: { copy: Record<string, unknown> }) { return null }
function SocialProofBar(_props: { copy: Record<string, unknown> }) { return null }
function AppPreviewSection(_props: { niches: NicheCardData[]; copy: Record<string, unknown> }) { return null }
function PainSolutionSection(_props: { copy: Record<string, unknown> }) { return null }
function FeaturesSection(_props: { copy: Record<string, unknown> }) { return null }
function PricingSection(_props: { copy: Record<string, unknown> }) { return null }
function TestimonialsSection(_props: { copy: Record<string, unknown> }) { return null }
function FinalCTASection(_props: { copy: Record<string, unknown> }) { return null }
function LandingFooter(_props: { copy: Record<string, unknown>; lang: Lang; onLangChange: (l: Lang) => void }) { return null }

interface LandingPageProps {
  niches: NicheCardData[]
}

export function LandingPage({ niches }: LandingPageProps) {
  const [lang, setLang] = useState<Lang>('en')
  const copy = COPY[lang]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
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
