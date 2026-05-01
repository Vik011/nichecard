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
    expect(screen.getByRole('button', { name: /shorts/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /longform/i })).toBeTruthy()
  })

  it('active content type button is visually distinguished', () => {
    render(<SearchFilters value={defaultFilters} onChange={() => {}} />)
    const shortsBtn = screen.getByRole('button', { name: /shorts/i })
    expect(shortsBtn.className).toMatch(/indigo|active|selected|bg-/)
    const longformBtn = screen.getByRole('button', { name: /longform/i })
    expect(longformBtn.className).not.toMatch(shortsBtn.className.split(' ').find(c => c.includes('indigo')) ?? 'NOMATCH')
  })

  it('clicking longform calls onChange with contentType longform', () => {
    const onChange = jest.fn()
    render(<SearchFilters value={defaultFilters} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /longform/i }))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'longform' })
    )
  })

  it('renders subscriber min/max inputs', () => {
    render(<SearchFilters value={defaultFilters} onChange={() => {}} />)
    expect(screen.getByLabelText(/min/i)).toBeTruthy()
    expect(screen.getByLabelText(/max/i)).toBeTruthy()
  })

  it('changing subscriber min calls onChange with updated value', () => {
    const onChange = jest.fn()
    render(<SearchFilters value={defaultFilters} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/min/i), { target: { value: '5000' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ subscriberMin: 5000 })
    )
  })

  it('renders channel age select with all options', () => {
    render(<SearchFilters value={defaultFilters} onChange={() => {}} />)
    const select = screen.getByLabelText(/channel age/i)
    const options = Array.from((select as HTMLSelectElement).options).map(o => o.value)
    expect(options).toEqual(expect.arrayContaining(['1month', '3months', '6months', '1year', 'any']))
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
