import { render, screen, fireEvent } from '@testing-library/react'
import { SearchFilters } from './SearchFilters'
import type { SearchFilters as SearchFiltersType } from '@/lib/types'

const defaultFilters: SearchFiltersType = {
  contentType: 'shorts',
  subscriberMin: 1000,
  subscriberMax: 100000,
  channelAge: 'any',
  onlyRecentlyViral: false,
  sortBy: 'score',
}

describe('SearchFilters', () => {
  it('renders content type toggle with both options', () => {
    render(<SearchFilters value={defaultFilters} onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: /shorts/i })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /longform/i })).toBeTruthy()
  })

  it('active content type button is visually distinguished', () => {
    render(<SearchFilters value={defaultFilters} onChange={() => {}} />)
    const shortsBtn = screen.getByRole('radio', { name: /shorts/i })
    expect(shortsBtn.getAttribute('aria-checked')).toBe('true')
    const longformBtn = screen.getByRole('radio', { name: /longform/i })
    expect(longformBtn.getAttribute('aria-checked')).toBe('false')
  })

  it('clicking longform calls onChange with contentType longform', () => {
    const onChange = jest.fn()
    render(<SearchFilters value={defaultFilters} onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /longform/i }))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'longform' })
    )
  })

  it('renders subscriber min/max inputs', () => {
    render(<SearchFilters value={defaultFilters} onChange={() => {}} />)
    expect(screen.getByLabelText(/min subscribers/i)).toBeTruthy()
    expect(screen.getByLabelText(/max subscribers/i)).toBeTruthy()
  })

  it('changing subscriber min calls onChange with updated value', () => {
    const onChange = jest.fn()
    render(<SearchFilters value={defaultFilters} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/min subscribers/i), { target: { value: '5000' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ subscriberMin: 5000 })
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
