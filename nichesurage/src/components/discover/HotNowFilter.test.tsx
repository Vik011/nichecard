import { render, screen, fireEvent } from '@testing-library/react'
import { HotNowFilter } from './HotNowFilter'
import { COPY } from '@/components/landing/copy'

describe('HotNowFilter', () => {
  it('renders three buttons and marks the active one with aria-pressed=true', () => {
    render(<HotNowFilter mode="hot" onChange={() => {}} copy={COPY.en} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
    const active = buttons.find(b => b.getAttribute('aria-pressed') === 'true')
    expect(active?.textContent).toMatch(/Hot now/i)
  })

  it('calls onChange with the new mode when a button is clicked', () => {
    const onChange = jest.fn()
    render(<HotNowFilter mode="hot" onChange={onChange} copy={COPY.en} />)
    fireEvent.click(screen.getByRole('button', { name: /quality/i }))
    expect(onChange).toHaveBeenCalledWith('quality')
  })
})
