/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { RevealCountdown } from './RevealCountdown'
import { COPY } from '@/components/landing/copy'

describe('RevealCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-05-22T23:30:00Z'))
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders the basic static badge for basic tier', () => {
    render(<RevealCountdown tier="basic" copy={COPY.en} />)
    expect(screen.getByText(COPY.en.revealBasicBadge)).toBeInTheDocument()
  })

  it('renders the premium static badge for premium tier', () => {
    render(<RevealCountdown tier="premium" copy={COPY.en} />)
    expect(screen.getByText(COPY.en.revealPremiumBadge)).toBeInTheDocument()
  })

  it('shows a countdown for free tier', () => {
    render(<RevealCountdown tier="free" copy={COPY.en} />)
    const el = screen.queryByText(new RegExp(COPY.en.revealNextLabel, 'i'))
    expect(el).not.toBeNull()
  })
})
