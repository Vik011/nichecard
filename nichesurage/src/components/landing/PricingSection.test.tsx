import { render, screen, fireEvent } from '@testing-library/react'
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

  it('renders tier prices (yearly default)', () => {
    render(<PricingSection copy={copy} />)
    expect(screen.getAllByText(copy.pricingFreePrice).length).toBeGreaterThan(0)
    expect(screen.getAllByText(copy.pricingBasicYearlyPrice).length).toBeGreaterThan(0)
    expect(screen.getAllByText(copy.pricingPremiumYearlyPrice).length).toBeGreaterThan(0)
  })

  it('renders all CTA buttons', () => {
    render(<PricingSection copy={copy} />)
    expect(screen.getByText(copy.pricingCtaFree)).toBeInTheDocument()
    expect(screen.getByText(copy.pricingCtaBasic)).toBeInTheDocument()
    expect(screen.getByText(copy.pricingCtaPremium)).toBeInTheDocument()
  })

  it('CTA buttons link to correct hrefs (yearly default)', () => {
    render(<PricingSection copy={copy} />)
    expect(screen.getByText(copy.pricingCtaFree).closest('a')).toHaveAttribute('href', '/login?plan=free')
    expect(screen.getByText(copy.pricingCtaBasic).closest('a')).toHaveAttribute('href', '/login?plan=basic&billing=yearly')
    expect(screen.getByText(copy.pricingCtaPremium).closest('a')).toHaveAttribute('href', '/login?plan=premium&billing=yearly')
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

  it('toggle defaults to Yearly', () => {
    render(<PricingSection copy={copy} />)
    const yearlyBtn = screen.getByRole('button', { name: new RegExp(copy.pricingToggleYearly, 'i') })
    expect(yearlyBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows yearly prices by default', () => {
    render(<PricingSection copy={copy} />)
    expect(screen.getByText(copy.pricingBasicYearlyPrice)).toBeInTheDocument()
    expect(screen.getByText(copy.pricingPremiumYearlyPrice)).toBeInTheDocument()
  })

  it('shows monthly prices after switching to Monthly', () => {
    render(<PricingSection copy={copy} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(copy.pricingToggleMonthly, 'i') }))
    expect(screen.getByText(copy.pricingBasicPrice)).toBeInTheDocument()
    expect(screen.getByText(copy.pricingPremiumPrice)).toBeInTheDocument()
  })

  it('CTA links include billing=yearly by default for paid plans', () => {
    render(<PricingSection copy={copy} />)
    expect(screen.getByText(copy.pricingCtaBasic).closest('a'))
      .toHaveAttribute('href', '/login?plan=basic&billing=yearly')
    expect(screen.getByText(copy.pricingCtaPremium).closest('a'))
      .toHaveAttribute('href', '/login?plan=premium&billing=yearly')
  })

  it('CTA links switch to billing=monthly when Monthly is selected', () => {
    render(<PricingSection copy={copy} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(copy.pricingToggleMonthly, 'i') }))
    expect(screen.getByText(copy.pricingCtaBasic).closest('a'))
      .toHaveAttribute('href', '/login?plan=basic&billing=monthly')
  })

  it('Free CTA always links to /login?plan=free without billing param', () => {
    render(<PricingSection copy={copy} />)
    expect(screen.getByText(copy.pricingCtaFree).closest('a'))
      .toHaveAttribute('href', '/login?plan=free')
  })

  it('Premium card has Best Value badge', () => {
    render(<PricingSection copy={copy} />)
    expect(screen.getByText(copy.pricingBestValueBadge)).toBeInTheDocument()
  })

  it('shows pricingYearlySaveBadge in the toggle', () => {
    render(<PricingSection copy={copy} />)
    expect(screen.getByText(copy.pricingYearlySaveBadge)).toBeInTheDocument()
  })
})
