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

  it('solution card carries emerald visual emphasis vs pain card', () => {
    // After the comparison-drama redesign (2026-05-06 round 3) and the
    // 2026-05-08 brand cleanup (no-blue), the solution card uses
    // ring-accent-emerald + glass-glow + drop-shadow. The pain card is
    // de-emphasized via opacity-75 + slate desaturation. Test asserts
    // the data-tone hooks exist (stable selector for future styling
    // rewrites) AND the emerald ring class is present on the solution
    // card specifically.
    const { container } = render(<PainSolutionSection copy={copy} />)
    const pain = container.querySelector('[data-tone="pain"]')
    const solution = container.querySelector('[data-tone="solution"]')
    expect(pain).toBeInTheDocument()
    expect(solution).toBeInTheDocument()
    expect(solution?.className).toMatch(/ring-accent-emerald/)
  })
})
