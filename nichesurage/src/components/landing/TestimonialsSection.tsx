import type { CopyKeys } from './copy'
import { MotionCard } from '@/components/ui/MotionCard'

interface TestimonialsSectionProps {
  copy: CopyKeys
}

export function TestimonialsSection({ copy }: TestimonialsSectionProps) {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-semibold text-center mb-14 text-slate-100 tracking-tight">
          {copy.testimonialsTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {copy.testimonials.map((t) => (
            <MotionCard
              key={t.handle}
              className="glass rounded-xl p-6 flex flex-col gap-5"
            >
              <p className="text-slate-200 text-[14px] leading-relaxed flex-1">{t.quote}</p>
              <div className="flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="w-10 h-10 rounded-[14px] bg-charcoal-700 flex items-center justify-center shrink-0 gborder"
                >
                  <span className="text-glow-indigo font-semibold text-sm">
                    {t.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-slate-100 font-semibold text-sm">{t.name}</p>
                  <p className="text-slate-500 text-xs">{t.handle}</p>
                  {t.detail && (
                    <p className="text-slate-600 text-[11px] mt-0.5 truncate">{t.detail}</p>
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
