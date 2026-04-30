import { render, screen } from '@testing-library/react'
import { PricingSection } from './PricingSection'
import { COPY } from './copy'

const copy = COPY.en

describe('PricingSection', () => {
  it('renders pricingTitle', () => {
    render(<PricingSection copy={copy} />)
    expect(screen.getByText(copy.pricingTitle)).toBeInTheDocument()
  })

  it('renders all tier names', () => {
    render(<PricingSection copy={copy} />)
    expect(screen.getByText(copy.pricingFree)).toBeInTheDocument()
    expect(screen.getByText(copy.pricingBasic)).toBeInTheDocument()
    expect(screen.getByText(copy.pricingPremium)).toBeInTheDocument()
  })

  it('renders all tier prices', () => {
    render(<PricingSection copy={copy} />)
    expect(screen.getAllByText(copy.pricingFreePrice).length).toBeGreaterThan(0)
    expect(screen.getAllByText(copy.pricingBasicPrice).length).toBeGreaterThan(0)
    expect(screen.getAllByText(copy.pricingPremiumPrice).length).toBeGreaterThan(0)
  })

  it('renders all CTA buttons', () => {
    render(<PricingSection copy={copy} />)
    expect(screen.getByText(copy.pricingCtaFree)).toBeInTheDocument()
    expect(screen.getByText(copy.pricingCtaBasic)).toBeInTheDocument()
    expect(screen.getByText(copy.pricingCtaPremium)).toBeInTheDocument()
  })

  it('CTA buttons link to /login?plan=X', () => {
    render(<PricingSection copy={copy} />)
    expect(screen.getByText(copy.pricingCtaFree).closest('a')).toHaveAttribute('href', '/login?plan=free')
    expect(screen.getByText(copy.pricingCtaBasic).closest('a')).toHaveAttribute('href', '/login?plan=basic')
    expect(screen.getByText(copy.pricingCtaPremium).closest('a')).toHaveAttribute('href', '/login?plan=premium')
  })

  it('renders all free tier features', () => {
    render(<PricingSection copy={copy} />)
    copy.pricingFreeFeatures.forEach(f => {
      expect(screen.getAllByText(f).length).toBeGreaterThan(0)
    })
  })

  it('renders all basic tier features', () => {
    render(<PricingSection copy={copy} />)
    copy.pricingBasicFeatures.forEach(f => {
      expect(screen.getAllByText(f).length).toBeGreaterThan(0)
    })
  })

  it('renders all premium tier features', () => {
    render(<PricingSection copy={copy} />)
    copy.pricingPremiumFeatures.forEach(f => {
      expect(screen.getAllByText(f).length).toBeGreaterThan(0)
    })
  })

  it('Premium tier card has violet border class', () => {
    const { container } = render(<PricingSection copy={copy} />)
    const cards = container.querySelectorAll('[class*="border-violet-500"]')
    expect(cards.length).toBeGreaterThan(0)
  })

  it('Basic tier card has indigo ring class', () => {
    const { container } = render(<PricingSection copy={copy} />)
    const cards = container.querySelectorAll('[class*="ring-indigo-500"]')
    expect(cards.length).toBeGreaterThan(0)
  })
})
