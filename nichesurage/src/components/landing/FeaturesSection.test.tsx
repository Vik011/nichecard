import { render, screen } from '@testing-library/react'
import { FeaturesSection } from './FeaturesSection'
import { COPY } from './copy'

const copy = COPY.en

describe('FeaturesSection', () => {
  it('renders featuresTitle', () => {
    render(<FeaturesSection copy={copy} />)
    expect(screen.getByText(copy.featuresTitle)).toBeInTheDocument()
  })

  it('renders all feature titles', () => {
    render(<FeaturesSection copy={copy} />)
    copy.features.forEach(f => {
      expect(screen.getByText(f.title)).toBeInTheDocument()
    })
  })

  it('renders all feature descriptions', () => {
    render(<FeaturesSection copy={copy} />)
    copy.features.forEach(f => {
      expect(screen.getByText(f.desc)).toBeInTheDocument()
    })
  })

  it('renders a lucide icon for each feature', () => {
    render(<FeaturesSection copy={copy} />)
    copy.features.forEach(f => {
      expect(screen.getByTestId(`feature-icon-${f.icon}`)).toBeInTheDocument()
    })
  })

  it('renders PREMIUM badge only on premium-tier features', () => {
    render(<FeaturesSection copy={copy} />)
    copy.features.forEach(f => {
      const badge = screen.queryByTestId(`feature-premium-badge-${f.icon}`)
      if (f.tier === 'premium') {
        expect(badge).toBeInTheDocument()
      } else {
        expect(badge).not.toBeInTheDocument()
      }
    })
  })

  it('renders featuresPremiumBadge text for each premium feature', () => {
    render(<FeaturesSection copy={copy} />)
    const premiumCount = copy.features.filter(f => f.tier === 'premium').length
    expect(screen.getAllByText(copy.featuresPremiumBadge).length).toBe(premiumCount)
  })
})
