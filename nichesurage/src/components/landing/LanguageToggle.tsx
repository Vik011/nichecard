'use client'
import type { Lang } from './copy'

interface LanguageToggleProps {
  lang: Lang
  onChange: (lang: Lang) => void
}

export function LanguageToggle({ lang, onChange }: LanguageToggleProps) {
  return (
    <div className="flex items-center gap-1 text-sm">
      <button
        onClick={() => onChange('en')}
        className={`px-2 py-0.5 rounded transition-colors ${
          lang === 'en'
            ? 'text-slate-100 font-semibold'
            : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        EN
      </button>
      <span className="text-slate-700">|</span>
      <button
        onClick={() => onChange('de')}
        className={`px-2 py-0.5 rounded transition-colors ${
          lang === 'de'
            ? 'text-slate-100 font-semibold'
            : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        DE
      </button>
    </div>
  )
}
