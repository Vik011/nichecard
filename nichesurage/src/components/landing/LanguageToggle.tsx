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
        aria-pressed={lang === 'en'}
        className={`px-2 py-0.5 rounded transition-colors ${
          lang === 'en'
            ? 'text-ink font-semibold'
            : 'text-ink-subtle hover:text-ink-muted'
        }`}
      >
        EN
      </button>
      <span className="text-ink-subtle">|</span>
      <button
        onClick={() => onChange('de')}
        aria-pressed={lang === 'de'}
        className={`px-2 py-0.5 rounded transition-colors ${
          lang === 'de'
            ? 'text-ink font-semibold'
            : 'text-ink-subtle hover:text-ink-muted'
        }`}
      >
        DE
      </button>
    </div>
  )
}
