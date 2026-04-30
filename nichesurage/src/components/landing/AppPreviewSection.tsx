import Link from 'next/link'
import { NicheCard } from '@/components/niche/NicheCard'
import type { NicheCardData } from '@/lib/types'
import type { CopyKeys } from './copy'

interface AppPreviewSectionProps {
  niches: NicheCardData[]
  copy: CopyKeys
}

export function AppPreviewSection({ niches, copy }: AppPreviewSectionProps) {
  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3 text-slate-100">
            {copy.previewTitle}
          </h2>
          <p className="text-slate-400 text-lg">{copy.previewSub}</p>
        </div>

        {/* Card grid with fade overlay */}
        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {niches.map((niche, i) => (
              <NicheCard key={niche.id} data={niche} userTier="free" rank={i + 1} />
            ))}
          </div>

          {/* Bottom fade — obscures last row to tease content */}
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none"
          />
        </div>

        {/* CTA below the grid */}
        <div className="text-center mt-8">
          <Link
            href="/login"
            className="inline-block text-base font-semibold px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all text-white shadow-lg shadow-indigo-900/40"
          >
            {copy.previewCta}
          </Link>
        </div>
      </div>
    </section>
  )
}
