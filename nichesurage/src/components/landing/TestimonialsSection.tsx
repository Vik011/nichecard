import type { CopyKeys } from './copy'

interface TestimonialsSectionProps {
  copy: CopyKeys
}

export function TestimonialsSection({ copy }: TestimonialsSectionProps) {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-slate-100">
          {copy.testimonialsTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {copy.testimonials.map((t) => (
            <div
              key={t.handle}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-4"
            >
              <p className="text-slate-300 text-sm leading-relaxed flex-1">"{t.quote}"</p>
              <div>
                <p className="text-slate-100 font-semibold text-sm">{t.name}</p>
                <p className="text-slate-500 text-xs">{t.handle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
