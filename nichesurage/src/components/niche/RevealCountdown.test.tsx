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

  it('free banner shows neutral "checking" copy while the pin is still loading', () => {
    // revealPending overrides the count: even with count 0 it must NOT show
    // "0 of 1" (which reads like a bug) — it shows the neutral checking state.
    render(<RevealCountdown tier="free" copy={COPY.en} revealedCount={0} revealPending />)
    expect(screen.getByText(COPY.en.revealCheckingBadge)).toBeInTheDocument()
    expect(screen.queryByText(COPY.en.revealFreeBadge)).toBeNull()
    expect(screen.queryByText(COPY.en.revealFreeBadgeNone)).toBeNull()
  })

  it('free banner claims "1 of 1 unlocked" only when loaded and revealedCount === 1', () => {
    render(<RevealCountdown tier="free" copy={COPY.en} revealedCount={1} revealPending={false} />)
    expect(screen.getByText(COPY.en.revealFreeBadge)).toBeInTheDocument()
    expect(screen.queryByText(COPY.en.revealFreeBadgeNone)).toBeNull()
    expect(screen.queryByText(COPY.en.revealCheckingBadge)).toBeNull()
  })

  it('free banner shows "0 of 1" when loaded and revealedCount === 0 (pin unavailable)', () => {
    render(<RevealCountdown tier="free" copy={COPY.en} revealedCount={0} revealPending={false} />)
    expect(screen.getByText(COPY.en.revealFreeBadgeNone)).toBeInTheDocument()
    expect(screen.queryByText(COPY.en.revealFreeBadge)).toBeNull()
    expect(screen.queryByText(COPY.en.revealCheckingBadge)).toBeNull()
  })
})
