import { render, screen, fireEvent } from '@testing-library/react'
import { UpsellModal } from './UpsellModal'
import { COPY } from '@/components/landing/copy'

const copy = COPY.en

describe('UpsellModal', () => {
  it('renders nothing for premium tier', () => {
    const { container } = render(
      <UpsellModal tier="premium" copy={copy} onClose={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('basic→premium variant wears the Premium indigo + gold accent', () => {
    const { container } = render(
      <UpsellModal tier="basic" copy={copy} onClose={() => {}} />,
    )
    expect(
      container.querySelector('[class*="from-premium-canvas"]'),
    ).not.toBeNull()
    expect(screen.getByText(copy.upsellCtaBasic).closest('a')).toHaveClass(
      'bg-premium-gold',
    )
  })

  it('free→basic variant keeps the emerald glass accent, no premium tokens', () => {
    const { container } = render(
      <UpsellModal tier="free" copy={copy} onClose={() => {}} />,
    )
    expect(
      container.querySelector('[class*="ring-accent-emerald"]'),
    ).not.toBeNull()
    expect(
      container.querySelector('[class*="from-premium-canvas"]'),
    ).toBeNull()
  })

  it('CTA links to the pricing section', () => {
    render(<UpsellModal tier="basic" copy={copy} onClose={() => {}} />)
    expect(screen.getByText(copy.upsellCtaBasic).closest('a')).toHaveAttribute(
      'href',
      '/#pricing',
    )
  })

  it('Escape key calls onClose', () => {
    const onClose = jest.fn()
    render(<UpsellModal tier="basic" copy={copy} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
