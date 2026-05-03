'use client'

import { useState } from 'react'
import { Plus, Minus } from '@phosphor-icons/react/dist/ssr'
import type { CopyKeys } from './copy'

interface FaqSectionProps {
  copy: CopyKeys
}

// Sprint A.7 — accordion-style FAQ on the landing page. Each item expands
// to surface the rationale behind the tier mechanics (6h reveal, AI
// quota, Google sign-in). Conversion-driving content: "I read the FAQ
// before I buy" is a common buyer behavior, especially when the pricing
// model has unfamiliar mechanics like rotating reveals.
export function FaqSection({ copy }: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0) // first item open by default

  return (
    <section id="faq" className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-semibold text-center text-slate-100 tracking-tight mb-10">
          {copy.faqTitle}
        </h2>
        <div className="flex flex-col gap-3">
          {copy.faqItems.map((item, i) => {
            const isOpen = openIndex === i
            return (
              <div
                key={i}
                className="gborder rounded-2xl bg-charcoal-900/40 backdrop-blur-md overflow-hidden"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-slate-100 hover:bg-charcoal-800/40 transition-colors"
                >
                  <span className="text-[15px] font-medium leading-snug">{item.q}</span>
                  <span aria-hidden className="text-glow-indigo shrink-0">
                    {isOpen ? <Minus weight="bold" size={16} /> : <Plus weight="bold" size={16} />}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-slate-400 text-sm leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
