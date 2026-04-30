import type { CopyKeys } from './copy'

interface FeaturesSectionProps {
  copy: CopyKeys
}

export function FeaturesSection({ copy }: FeaturesSectionProps) {
  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-slate-100">
          {copy.featuresTitle}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {copy.features.map((feature) => (
            <div
              key={feature.title}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6"
            >
              <span className="text-3xl mb-4 block" aria-hidden="true">{feature.icon}</span>
              <h3 className="text-slate-100 font-semibold mb-2">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
