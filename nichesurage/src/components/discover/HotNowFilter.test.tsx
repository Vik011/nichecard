import { render, screen, fireEvent } from '@testing-library/react'
import { HotNowFilter } from './HotNowFilter'
import { COPY } from '@/components/landing/copy'

describe('HotNowFilter', () => {
  it('renders three tabs and marks the active one with aria-selected=true', () => {
    render(<HotNowFilter mode="hot" onChange={() => {}} copy={COPY.en} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    const active = tabs.find(t => t.getAttribute('aria-selected') === 'true')
    expect(active?.textContent).toMatch(/Hot now/i)
  })

  it('calls onChange with the new mode when a tab is clicked', () => {
    const onChange = jest.fn()
    render(<HotNowFilter mode="hot" onChange={onChange} copy={COPY.en} />)
    fireEvent.click(screen.getByRole('tab', { name: /quality/i }))
    expect(onChange).toHaveBeenCalledWith('quality')
  })
})
