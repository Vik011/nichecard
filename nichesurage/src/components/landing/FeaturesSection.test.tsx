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

  it('renders a lucide svg icon for each feature', () => {
    const { container } = render(<FeaturesSection copy={copy} />)
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBe(copy.features.length)
  })
})
