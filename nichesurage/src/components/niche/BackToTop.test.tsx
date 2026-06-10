import { render, screen, fireEvent } from '@testing-library/react'
import { BackToTop } from './BackToTop'

// jsdom reports scrollY = 0, doesn't implement scrollTo, and defaults
// innerHeight to 768. Pin all three so the viewport-height threshold
// (default 1.5 * innerHeight) is deterministic.
const LABEL = 'Back to top'

function setScrollY(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: y })
}

beforeEach(() => {
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 800 })
  setScrollY(0)
  window.scrollTo = jest.fn() as unknown as typeof window.scrollTo
})

describe('BackToTop', () => {
  it('is hidden initially when scrollY = 0', () => {
    render(<BackToTop label={LABEL} />)
    expect(screen.queryByRole('button', { name: LABEL })).not.toBeInTheDocument()
  })

  it('appears after scrolling past the threshold (1.5 * innerHeight)', () => {
    render(<BackToTop label={LABEL} />)
    setScrollY(1300) // > 1.5 * 800 (1200)
    fireEvent.scroll(window)
    expect(screen.getByRole('button', { name: LABEL })).toBeInTheDocument()
  })

  it('click scrolls smoothly to the top', () => {
    render(<BackToTop label={LABEL} />)
    setScrollY(1300)
    fireEvent.scroll(window)
    fireEvent.click(screen.getByRole('button', { name: LABEL }))
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('hides again when scroll drops back below the threshold', () => {
    render(<BackToTop label={LABEL} />)
    setScrollY(1300)
    fireEvent.scroll(window)
    expect(screen.getByRole('button', { name: LABEL })).toBeInTheDocument()

    setScrollY(100) // < 1200
    fireEvent.scroll(window)
    expect(screen.queryByRole('button', { name: LABEL })).not.toBeInTheDocument()
  })

  it('exposes the provided accessible label', () => {
    setScrollY(1300)
    render(<BackToTop label="Zurück nach oben" />)
    expect(screen.getByLabelText('Zurück nach oben')).toBeInTheDocument()
  })

  it('respects a custom thresholdVh', () => {
    render(<BackToTop label={LABEL} thresholdVh={3} />)
    setScrollY(1300) // > 1.5*800 but < 3*800 (2400) → still hidden
    fireEvent.scroll(window)
    expect(screen.queryByRole('button', { name: LABEL })).not.toBeInTheDocument()
  })
})
