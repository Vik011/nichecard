import { render, screen, fireEvent } from '@testing-library/react'
import { SearchFilters } from './SearchFilters'
import type { SearchFilters as SearchFiltersType } from '@/lib/types'

const defaultFilters: SearchFiltersType = {
  contentType: 'shorts',
  subscriberMin: 1000,
  subscriberMax: 5000,
  channelAge: 'any',
  onlyRecentlyViral: false,
  sortBy: 'score',
}

describe('SearchFilters', () => {
  it('does not render a Format (shorts/longform) toggle (it lives in the top nav now)', () => {
    render(<SearchFilters value={defaultFilters} onChange={() => {}} />)
    // The Subscriber, Channel age, and Sort radiogroups should be present...
    expect(screen.getByRole('radiogroup', { name: /subscriber range/i })).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: /channel age/i })).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: /sort/i })).toBeTruthy()
    // ...but no Format radiogroup.
    expect(screen.queryByRole('radiogroup', { name: /format/i })).toBeNull()
  })

  it('renders subscriber range bucket pills', () => {
    render(<SearchFilters value={defaultFilters} onChange={() => {}} />)
    const group = screen.getByRole('radiogroup', { name: /subscriber range/i })
    const labels = Array.from(group.querySelectorAll('button[role="radio"]')).map(b => b.textContent)
    expect(labels).toEqual(
      expect.arrayContaining(['Any', '< 1K', '1K – 5K', '5K – 10K', '10K – 50K', '50K – 100K', '100K+'])
    )
  })

  it('active subscriber bucket reflects current min/max', () => {
    render(<SearchFilters value={defaultFilters} onChange={() => {}} />)
    const group = screen.getByRole('radiogroup', { name: /subscriber range/i })
    const active = group.querySelector('button[role="radio"][aria-checked="true"]')
    expect(active?.textContent).toBe('1K – 5K')
  })

  it('clicking a subscriber bucket calls onChange with bucket min/max', () => {
    const onChange = jest.fn()
    render(<SearchFilters value={defaultFilters} onChange={onChange} />)
    const group = screen.getByRole('radiogroup', { name: /subscriber range/i })
    const tenToFifty = Array.from(group.querySelectorAll('button[role="radio"]'))
      .find(b => b.textContent === '10K – 50K')!
    fireEvent.click(tenToFifty)
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ subscriberMin: 10_000, subscriberMax: 50_000 })
    )
  })

  it('renders channel age radio group with all options', () => {
    render(<SearchFilters value={defaultFilters} onChange={() => {}} />)
    const group = screen.getByRole('radiogroup', { name: /channel age/i })
    const labels = Array.from(group.querySelectorAll('button[role="radio"]')).map(b => b.textContent)
    expect(labels).toEqual(expect.arrayContaining(['1 mo', '3 mo', '6 mo', '1 yr', 'Any']))
  })

  it('renders viral-only toggle and clicking it calls onChange', () => {
    const onChange = jest.fn()
    render(<SearchFilters value={defaultFilters} onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /viral/i }))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ onlyRecentlyViral: true })
    )
  })

  it('renders sort toggle with Best score active by default', () => {
    render(<SearchFilters value={defaultFilters} onChange={() => {}} />)
    const scoreBtn = screen.getByRole('radio', { name: /best score/i })
    const newestBtn = screen.getByRole('radio', { name: /newest/i })
    expect(scoreBtn.getAttribute('aria-checked')).toBe('true')
    expect(newestBtn.getAttribute('aria-checked')).toBe('false')
  })

  it('clicking Newest calls onChange with sortBy=newest', () => {
    const onChange = jest.fn()
    render(<SearchFilters value={defaultFilters} onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /newest/i }))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'newest' })
    )
  })
})
