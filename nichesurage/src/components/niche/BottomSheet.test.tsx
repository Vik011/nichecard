import { render, screen, fireEvent } from '@testing-library/react'
import { BottomSheet } from './BottomSheet'

describe('BottomSheet', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
  })

  it('renders nothing when closed', () => {
    render(
      <BottomSheet open={false} onClose={jest.fn()}>
        <p>body</p>
      </BottomSheet>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the sheet and children when open', () => {
    render(
      <BottomSheet open onClose={jest.fn()} ariaLabel="Test sheet">
        <p>body content</p>
      </BottomSheet>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Test sheet')
    expect(screen.getByText('body content')).toBeInTheDocument()
  })

  it('renders a drag handle for swipe affordance', () => {
    render(
      <BottomSheet open onClose={jest.fn()}>
        <p>body</p>
      </BottomSheet>,
    )
    expect(screen.getByTestId('bottom-sheet-handle')).toBeInTheDocument()
  })

  it('calls onClose when X is clicked', () => {
    const onClose = jest.fn()
    render(
      <BottomSheet open onClose={onClose}>
        <p>body</p>
      </BottomSheet>,
    )
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on ESC', () => {
    const onClose = jest.fn()
    render(
      <BottomSheet open onClose={onClose}>
        <p>body</p>
      </BottomSheet>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on backdrop mousedown', () => {
    const onClose = jest.fn()
    render(
      <BottomSheet open onClose={onClose}>
        <p>body</p>
      </BottomSheet>,
    )
    const dialog = screen.getByRole('dialog')
    const backdrop = dialog.parentElement
    expect(backdrop).not.toBeNull()
    fireEvent.mouseDown(backdrop!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('locks body scroll while open and restores on close', () => {
    const { rerender } = render(
      <BottomSheet open onClose={jest.fn()}>
        <p>body</p>
      </BottomSheet>,
    )
    expect(document.body.style.overflow).toBe('hidden')

    rerender(
      <BottomSheet open={false} onClose={jest.fn()}>
        <p>body</p>
      </BottomSheet>,
    )
    expect(document.body.style.overflow).toBe('')
  })
})
