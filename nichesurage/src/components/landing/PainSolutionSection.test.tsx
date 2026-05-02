import { render, screen } from '@testing-library/react'
import { PainSolutionSection } from './PainSolutionSection'
import { COPY } from './copy'

const copy = COPY.en

describe('PainSolutionSection', () => {
  it('renders painHeadline', () => {
    render(<PainSolutionSection copy={copy} />)
    expect(screen.getByText(copy.painHeadline)).toBeInTheDocument()
  })

  it('renders painTitle', () => {
    render(<PainSolutionSection copy={copy} />)
    expect(screen.getByText(copy.painTitle)).toBeInTheDocument()
  })

  it('renders all painItems', () => {
    render(<PainSolutionSection copy={copy} />)
    copy.painItems.forEach(item => {
      expect(screen.getByText(item)).toBeInTheDocument()
    })
  })

  it('renders solutionTitle', () => {
    render(<PainSolutionSection copy={copy} />)
    expect(screen.getByText(copy.solutionTitle)).toBeInTheDocument()
  })

  it('renders all solutionItems', () => {
    render(<PainSolutionSection copy={copy} />)
    copy.solutionItems.forEach(item => {
      expect(screen.getByText(item)).toBeInTheDocument()
    })
  })

  it('has an element with indigo-800 border class (separator)', () => {
    const { container } = render(<PainSolutionSection copy={copy} />)
    const el = container.querySelector('[class*="border-indigo-800"]')
    expect(el).toBeInTheDocument()
  })
})
