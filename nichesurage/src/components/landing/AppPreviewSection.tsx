import Link from 'next/link'
import { NicheCard } from '@/components/niche/NicheCard'
import type { NicheCardData } from '@/lib/types'
import type { CopyKeys } from './copy'

interface AppPreviewSectionProps {
  niches: NicheCardData[]
  copy: CopyKeys
  isLoggedIn?: boolean
}

export function AppPreviewSection({ niches, copy, isLoggedIn = false }: AppPreviewSectionProps) {
  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-semibold mb-3 text-slate-100 tracking-tight text-balance">
            {copy.previewTitle}
          </h2>
          <p className="text-slate-400 text-[17px]">{copy.previewSub}</p>
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
            className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#060910] via-[#060910]/60 to-transparent pointer-events-none"
          />
        </div>

        {/* CTA below the grid */}
        <div className="text-center mt-10">
          <Link
            href={isLoggedIn ? '/discover/shorts' : '/login'}
            className="inline-block text-[15px] font-semibold px-7 py-3 rounded-xl bg-gradient-to-br from-brand-indigo to-brand-indigo-bright hover:brightness-110 hover:shadow-glow-cyan transition-all text-white shadow-[0_8px_24px_-6px_rgba(124,131,240,0.45)]"
          >
            {isLoggedIn ? copy.navOpenApp : copy.previewCta}
          </Link>
        </div>
      </div>
    </section>
  )
}
