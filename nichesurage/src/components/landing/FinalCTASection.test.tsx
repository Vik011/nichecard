import { render, screen } from '@testing-library/react'
import { FinalCTASection } from './FinalCTASection'
import { COPY } from './copy'

const copy = COPY.en

describe('FinalCTASection', () => {
  it('renders ctaHeadline', () => {
    render(<FinalCTASection copy={copy} />)
    expect(screen.getByText(copy.ctaHeadline)).toBeInTheDocument()
  })

  it('section has gradient background classes', () => {
    const { container } = render(<FinalCTASection copy={copy} />)
    const section = container.querySelector('section')
    expect(section?.className).toMatch(/from-indigo-900/)
    expect(section?.className).toMatch(/to-violet-900/)
  })

  it('renders ctaButton linking to /login', () => {
    render(<FinalCTASection copy={copy} />)
    const btn = screen.getByText(copy.ctaButton)
    expect(btn).toBeInTheDocument()
    expect(btn.closest('a')).toHaveAttribute('href', '/login')
  })
})
