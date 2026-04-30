import { render, screen } from '@testing-library/react'
import { FinalCTASection } from './FinalCTASection'
import { COPY } from './copy'

const copy = COPY.en

describe('FinalCTASection', () => {
  it('renders ctaHeadline', () => {
    render(<FinalCTASection copy={copy} />)
    expect(screen.getByText(copy.ctaHeadline)).toBeInTheDocument()
  })

  it('renders ctaButton linking to /login', () => {
    render(<FinalCTASection copy={copy} />)
    const btn = screen.getByText(copy.ctaButton)
    expect(btn).toBeInTheDocument()
    expect(btn.closest('a')).toHaveAttribute('href', '/login')
  })
})
