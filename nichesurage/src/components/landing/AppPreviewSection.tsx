import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
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
    // py-24 -> py-16: round 3 microfix — the hero ends with a min-h-[68vh]
    // bottom and a radar fade, and AppPreview adding pt-24 on top of that
    // leaves a visible void between the hero stats bar and "These niches
    // are moving right now." Trimming both top and bottom padding closes
    // that gap without crowding the section heading.
    <section className="py-16 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl md:text-5xl font-normal mb-3 text-slate-100 tracking-[-0.01em] text-balance">
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

        {/* CTA below the grid — wrapped in a relative container with a
            subtle radial halo behind the button so it doesn't read as a
            stranded element floating between sections. The halo echoes
            the hero / FinalCTA radial-glow visual language. The button
            also gains an ArrowRight icon to match the hero "Open app →"
            CTA's affordance. */}
        <div className="relative text-center mt-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -inset-y-8"
            style={{
              background:
                'radial-gradient(ellipse 35% 100% at center, rgba(16,185,129,0.10), transparent 70%)',
            }}
          />
          <Link
            // Unified Discover surface — point straight at /discover.
            href={isLoggedIn ? '/discover' : '/login'}
            className="group relative inline-flex items-center gap-2 text-[15px] font-semibold px-7 py-3 rounded-xl bg-white text-charcoal-900 hover:bg-slate-100 transition-all"
          >
            <span>{isLoggedIn ? copy.navOpenApp : copy.previewCta}</span>
            <ArrowRight
              size={16}
              weight="bold"
              aria-hidden
              className="transition-transform duration-200 ease-out group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </div>
    </section>
  )
}
