'use client'
import type { CopyKeys, Lang } from './copy'
import { LanguageToggle } from './LanguageToggle'

interface LandingFooterProps {
  copy: CopyKeys
  lang: Lang
  onLangChange: (l: Lang) => void
}

export function LandingFooter({ copy, lang, onLangChange }: LandingFooterProps) {
  return (
    <footer className="relative border-t border-white/[0.05] py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
          <div className="flex flex-col gap-2">
            <span className="text-slate-100 font-semibold text-lg">NicheSurge</span>
            <p className="text-slate-500 text-sm max-w-xs">{copy.footerTagline}</p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              {copy.footerLinks}
            </span>
            <a href="/discover" className="text-slate-400 hover:text-slate-200 text-sm transition-colors">
              {copy.navDiscover}
            </a>
            <a href="#pricing" className="text-slate-400 hover:text-slate-200 text-sm transition-colors">
              {copy.navPricing}
            </a>
            <a href="/dashboard" className="text-slate-400 hover:text-slate-200 text-sm transition-colors">
              {copy.navDashboard}
            </a>
            <a href="/login" className="text-slate-400 hover:text-slate-200 text-sm transition-colors">
              {copy.navLogin}
            </a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              {copy.footerLegal}
            </span>
            <a href="/privacy" className="text-slate-400 hover:text-slate-200 text-sm transition-colors">
              {copy.footerPrivacy}
            </a>
            <a href="/terms" className="text-slate-400 hover:text-slate-200 text-sm transition-colors">
              {copy.footerTerms}
            </a>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8 border-t border-white/[0.05]">
          <p className="text-slate-600 text-sm">{copy.footerCopyright}</p>
          <LanguageToggle lang={lang} onChange={onLangChange} />
        </div>
      </div>
    </footer>
  )
}
