import { render, screen, act } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { HeroBackdrop } from './HeroBackdrop'
import { COPY } from './copy'
import type { RadarPing } from '@/lib/landing/fetchRadarPings'

// Strip framer-motion animations in tests so timer advances render the
// next ping synchronously.
jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: new Proxy({}, {
    get: () => (props: ComponentProps<'div'>) => <div {...props} />,
  }),
}))

const samplePings: RadarPing[] = [
  { id: 'p1', outlierRatio: 3.2, clusterLabel: 'Stoic Mind Rewiring', language: 'en', contentType: 'longform' },
  { id: 'p2', outlierRatio: 7.5, clusterLabel: 'Faceless AI Income Blueprint', language: 'en', contentType: 'shorts' },
  { id: 'p3', outlierRatio: 12.0, clusterLabel: 'Silent Stoic Male Psychology', language: 'de', contentType: 'shorts' },
]

// HeroBackdrop currently owns ONLY the radar visual + the rotating
// bottom-right "channel discovered" ping notification. The live channel
// counter moved to LiveTickerBar; the next-scan countdown moved to
// HeroStatsBar. Tests that previously asserted on those elements were
// removed when the elements were hoisted out.

describe('HeroBackdrop — rotating ping notification', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows the first ping immediately on mount', () => {
    render(<HeroBackdrop copy={COPY.en} pings={samplePings} channelsLast24h={47} />)
    expect(screen.getByText(/3\.2× outlier/)).toBeInTheDocument()
    expect(screen.getByText(/Stoic Mind Rewiring/)).toBeInTheDocument()
  })

  it('rotates to the next ping after the interval elapses', () => {
    render(<HeroBackdrop copy={COPY.en} pings={samplePings} channelsLast24h={47} />)
    expect(screen.getByText(/3\.2× outlier/)).toBeInTheDocument()
    act(() => {
      jest.advanceTimersByTime(3200)
    })
    expect(screen.getByText(/7\.5× outlier/)).toBeInTheDocument()
  })

  it('does not render the toast when there are no pings', () => {
    render(<HeroBackdrop copy={COPY.en} pings={[]} channelsLast24h={0} />)
    expect(screen.queryByText(/× outlier/)).not.toBeInTheDocument()
  })

  it('localizes the ping prefix to German', () => {
    render(<HeroBackdrop copy={COPY.de} pings={samplePings} channelsLast24h={47} />)
    expect(screen.getByText(/Kanal entdeckt/)).toBeInTheDocument()
  })
})
