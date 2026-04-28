import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BookmarkButton } from './BookmarkButton'

const mockSaveNiche = jest.fn()
const mockUnsaveNiche = jest.fn()

jest.mock('@/lib/supabase/savedNiches', () => ({
  saveNiche: (...args: unknown[]) => mockSaveNiche(...args),
  unsaveNiche: (...args: unknown[]) => mockUnsaveNiche(...args),
}))

describe('BookmarkButton', () => {
  beforeEach(() => {
    mockSaveNiche.mockReset()
    mockUnsaveNiche.mockReset()
    mockSaveNiche.mockResolvedValue({ error: null })
    mockUnsaveNiche.mockResolvedValue({ error: null })
  })

  it('shows "Save niche" aria-label when not saved', () => {
    render(
      <BookmarkButton nicheId="n1" isSaved={false} userTier="basic" savedCount={0} onToggle={() => {}} />
    )
    expect(screen.getByRole('button', { name: /save niche/i })).toBeInTheDocument()
  })

  it('shows "Unsave niche" aria-label when saved', () => {
    render(
      <BookmarkButton nicheId="n1" isSaved={true} userTier="basic" savedCount={1} onToggle={() => {}} />
    )
    expect(screen.getByRole('button', { name: /unsave niche/i })).toBeInTheDocument()
  })

  it('calls saveNiche and onToggle(id, true) on click when not saved', async () => {
    const onToggle = jest.fn()
    render(
      <BookmarkButton nicheId="n1" isSaved={false} userTier="basic" savedCount={3} onToggle={onToggle} />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(mockSaveNiche).toHaveBeenCalledWith('n1')
    await waitFor(() => expect(onToggle).toHaveBeenCalledWith('n1', true))
  })

  it('calls unsaveNiche and onToggle(id, false) on click when saved', async () => {
    const onToggle = jest.fn()
    render(
      <BookmarkButton nicheId="n1" isSaved={true} userTier="basic" savedCount={5} onToggle={onToggle} />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(mockUnsaveNiche).toHaveBeenCalledWith('n1')
    await waitFor(() => expect(onToggle).toHaveBeenCalledWith('n1', false))
  })

  it('shows upgrade tooltip for free tier and does not call saveNiche', () => {
    render(
      <BookmarkButton nicheId="n1" isSaved={false} userTier="free" savedCount={0} onToggle={() => {}} />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(mockSaveNiche).not.toHaveBeenCalled()
    expect(screen.getByText(/upgrade to basic/i)).toBeInTheDocument()
  })

  it('shows limit tooltip for basic tier at 10 saves and does not call saveNiche', () => {
    render(
      <BookmarkButton nicheId="n1" isSaved={false} userTier="basic" savedCount={10} onToggle={() => {}} />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(mockSaveNiche).not.toHaveBeenCalled()
    expect(screen.getByText(/save limit reached/i)).toBeInTheDocument()
  })
})
