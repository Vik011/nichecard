'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { LanguageToggle } from './LanguageToggle'
import type { CopyKeys, Lang } from './copy'

interface LandingNavProps {
  copy: CopyKeys
  lang: Lang
  onLangChange: (lang: Lang) => void
}

export function LandingNav({ copy, lang, onLangChange }: LandingNavProps) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? 'backdrop-blur-md bg-slate-950/80 border-b border-slate-800'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent"
        >
          NicheSurge
        </Link>

        {/* Desktop links */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
          <Link href="/discover/shorts" className="hover:text-slate-100 transition-colors">
            {copy.navDiscover}
          </Link>
          <a href="#pricing" className="hover:text-slate-100 transition-colors">
            {copy.navPricing}
          </a>
          <LanguageToggle lang={lang} onChange={onLangChange} />
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-slate-400 hover:text-slate-100 transition-colors px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500"
          >
            {copy.navLogin}
          </Link>
          <Link
            href="/login"
            className="text-sm font-semibold px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all text-white"
          >
            {copy.navCta}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-slate-400 hover:text-slate-100"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden bg-slate-900 border-t border-slate-800 px-6 py-4 flex flex-col gap-4">
          <Link href="/discover/shorts" className="text-slate-300 hover:text-white" onClick={() => setMenuOpen(false)}>
            {copy.navDiscover}
          </Link>
          <a href="#pricing" className="text-slate-300 hover:text-white" onClick={() => setMenuOpen(false)}>
            {copy.navPricing}
          </a>
          <LanguageToggle lang={lang} onChange={onLangChange} />
          <Link
            href="/login"
            className="text-center text-sm font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
            onClick={() => setMenuOpen(false)}
          >
            {copy.navCta}
          </Link>
        </div>
      )}
    </header>
  )
}
