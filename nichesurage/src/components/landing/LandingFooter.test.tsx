import { render, screen, fireEvent } from '@testing-library/react'
import { LandingFooter } from './LandingFooter'
import { COPY } from './copy'

const copy = COPY.en

describe('LandingFooter', () => {
  it('renders footerTagline', () => {
    render(<LandingFooter copy={copy} lang="en" onLangChange={() => {}} />)
    expect(screen.getByText(copy.footerTagline)).toBeInTheDocument()
  })

  it('renders footerCopyright', () => {
    render(<LandingFooter copy={copy} lang="en" onLangChange={() => {}} />)
    expect(screen.getByText(copy.footerCopyright)).toBeInTheDocument()
  })

  it('renders Privacy and Terms links', () => {
    render(<LandingFooter copy={copy} lang="en" onLangChange={() => {}} />)
    expect(screen.getByText(copy.footerPrivacy)).toBeInTheDocument()
    expect(screen.getByText(copy.footerTerms)).toBeInTheDocument()
  })

  it('calls onLangChange when language toggle is used', () => {
    const onLangChange = jest.fn()
    render(<LandingFooter copy={copy} lang="en" onLangChange={onLangChange} />)
    const deButton = screen.getByRole('button', { name: /DE/i })
    fireEvent.click(deButton)
    expect(onLangChange).toHaveBeenCalledWith('de')
  })
})
