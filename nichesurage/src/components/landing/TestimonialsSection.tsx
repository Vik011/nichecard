import type { CopyKeys } from './copy'
import { MotionCard } from '@/components/ui/MotionCard'

interface TestimonialsSectionProps {
  copy: CopyKeys
}

export function TestimonialsSection({ copy }: TestimonialsSectionProps) {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-display text-4xl md:text-5xl font-normal text-center mb-14 text-ink tracking-[-0.01em]">
          {copy.testimonialsTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {copy.testimonials.map((t) => (
            <MotionCard
              key={t.handle}
              className="glass rounded-xl p-6 flex flex-col gap-5"
            >
              <p className="text-ink text-[14px] leading-relaxed flex-1">{t.quote}</p>
              <div className="flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="w-10 h-10 rounded-[14px] bg-surface-overlay flex items-center justify-center shrink-0 gborder"
                >
                  <span className="text-accent-emerald-bright font-semibold text-sm">
                    {t.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-ink font-semibold text-sm">{t.name}</p>
                  <p className="text-ink-subtle text-xs">{t.handle}</p>
                  {t.detail && (
                    <p className="text-ink-subtle text-[11px] mt-0.5 truncate">{t.detail}</p>
                  )}
                </div>
              </div>
            </MotionCard>
          ))}
        </div>
      </div>
    </section>
  )
}
