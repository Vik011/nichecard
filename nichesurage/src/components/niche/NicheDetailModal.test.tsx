import { render, screen, fireEvent } from '@testing-library/react'
import { NicheDetailModal } from './NicheDetailModal'

describe('NicheDetailModal', () => {
  beforeEach(() => {
    // Each test gets a clean body with no leftover overflow lock from
    // previous tests' unmount.
    document.body.style.overflow = ''
  })

  it('renders nothing when closed', () => {
    const onClose = jest.fn()
    render(
      <NicheDetailModal open={false} onClose={onClose}>
        <p>body</p>
      </NicheDetailModal>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('body')).not.toBeInTheDocument()
  })

  it('renders the dialog and children when open', () => {
    const onClose = jest.fn()
    render(
      <NicheDetailModal open onClose={onClose} ariaLabel="Test niche">
        <p>body content</p>
      </NicheDetailModal>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Test niche')
    expect(screen.getByText('body content')).toBeInTheDocument()
  })

  it('calls onClose when the X button is clicked', () => {
    const onClose = jest.fn()
    render(
      <NicheDetailModal open onClose={onClose}>
        <p>body</p>
      </NicheDetailModal>,
    )
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when ESC is pressed', () => {
    const onClose = jest.fn()
    render(
      <NicheDetailModal open onClose={onClose}>
        <p>body</p>
      </NicheDetailModal>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onClose when other keys are pressed', () => {
    const onClose = jest.fn()
    render(
      <NicheDetailModal open onClose={onClose}>
        <p>body</p>
      </NicheDetailModal>,
    )
    fireEvent.keyDown(document, { key: 'Enter' })
    fireEvent.keyDown(document, { key: 'a' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('locks body scroll while open and restores on close', () => {
    const onClose = jest.fn()
    const { rerender } = render(
      <NicheDetailModal open onClose={onClose}>
        <p>body</p>
      </NicheDetailModal>,
    )
    expect(document.body.style.overflow).toBe('hidden')

    rerender(
      <NicheDetailModal open={false} onClose={onClose}>
        <p>body</p>
      </NicheDetailModal>,
    )
    expect(document.body.style.overflow).toBe('')
  })

  it('falls back to a default aria-label when none is supplied', () => {
    const onClose = jest.fn()
    render(
      <NicheDetailModal open onClose={onClose}>
        <p>body</p>
      </NicheDetailModal>,
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Niche detail')
  })

  it('calls onClose when the backdrop is mousedown-clicked (target === backdrop)', () => {
    const onClose = jest.fn()
    render(
      <NicheDetailModal open onClose={onClose}>
        <p>body</p>
      </NicheDetailModal>,
    )
    // The backdrop is the dialog's parent element. Click directly on it
    // (not on the dialog) should close.
    const dialog = screen.getByRole('dialog')
    const backdrop = dialog.parentElement
    expect(backdrop).not.toBeNull()
    fireEvent.mouseDown(backdrop!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onClose when mousedown lands inside the dialog', () => {
    const onClose = jest.fn()
    render(
      <NicheDetailModal open onClose={onClose}>
        <p data-testid="inner">body</p>
      </NicheDetailModal>,
    )
    fireEvent.mouseDown(screen.getByTestId('inner'))
    expect(onClose).not.toHaveBeenCalled()
  })

  // Sprint 2026-05-13 (modal redesign Phase B): mobile branch.
  describe('mobile viewport (< 640px)', () => {
    let originalInnerWidth: number

    beforeAll(() => {
      originalInnerWidth = window.innerWidth
    })

    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
      window.dispatchEvent(new Event('resize'))
    })

    afterAll(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth })
      window.dispatchEvent(new Event('resize'))
    })

    it('renders a drag handle on mobile (bottom-sheet branch)', () => {
      render(
        <NicheDetailModal open onClose={jest.fn()}>
          <p>body</p>
        </NicheDetailModal>,
      )
      expect(screen.getByTestId('bottom-sheet-handle')).toBeInTheDocument()
    })

    it('still closes on ESC in the bottom-sheet branch', () => {
      const onClose = jest.fn()
      render(
        <NicheDetailModal open onClose={onClose}>
          <p>body</p>
        </NicheDetailModal>,
      )
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })
})
