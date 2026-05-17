'use client'
import type { CopyKeys, Lang } from './copy'
import { LanguageToggle } from './LanguageToggle'
import { LogoStacked } from '@/components/brand/LogoStacked'

interface LandingFooterProps {
  copy: CopyKeys
  lang: Lang
  onLangChange: (l: Lang) => void
}

export function LandingFooter({ copy, lang, onLangChange }: LandingFooterProps) {
  return (
    <footer className="relative border-t border-hairline-soft py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
          <div className="flex flex-col gap-3">
            <LogoStacked iconSize={44} className="!items-start" />
            <p className="text-ink-subtle text-sm max-w-xs">{copy.footerTagline}</p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-ink-muted text-xs font-semibold uppercase tracking-wider">
              {copy.footerLinks}
            </span>
            <a href="/discover" className="text-ink-muted hover:text-ink text-sm transition-colors">
              {copy.navDiscover}
            </a>
            <a href="#pricing" className="text-ink-muted hover:text-ink text-sm transition-colors">
              {copy.navPricing}
            </a>
            <a href="/dashboard" className="text-ink-muted hover:text-ink text-sm transition-colors">
              {copy.navDashboard}
            </a>
            <a href="/login" className="text-ink-muted hover:text-ink text-sm transition-colors">
              {copy.navLogin}
            </a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-ink-muted text-xs font-semibold uppercase tracking-wider">
              {copy.footerLegal}
            </span>
            <a href="/privacy" className="text-ink-muted hover:text-ink text-sm transition-colors">
              {copy.footerPrivacy}
            </a>
            <a href="/terms" className="text-ink-muted hover:text-ink text-sm transition-colors">
              {copy.footerTerms}
            </a>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8 border-t border-hairline-soft">
          <p className="text-ink-subtle text-sm">{copy.footerCopyright}</p>
          <LanguageToggle lang={lang} onChange={onLangChange} />
        </div>
      </div>
    </footer>
  )
}
