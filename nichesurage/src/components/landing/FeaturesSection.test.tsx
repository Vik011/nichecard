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

  it('renders all feature icons', () => {
    render(<FeaturesSection copy={copy} />)
    copy.features.forEach(f => {
      expect(screen.getByText(f.icon)).toBeInTheDocument()
    })
  })
})
