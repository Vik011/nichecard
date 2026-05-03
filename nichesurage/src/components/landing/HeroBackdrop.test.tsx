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

describe('HeroBackdrop', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders the floating live counter with the provided 24h count', () => {
    render(<HeroBackdrop copy={COPY.en} pings={samplePings} channelsLast24h={47} />)
    expect(screen.getByText(/47 channels surfaced in the last 24h/)).toBeInTheDocument()
  })

  it('shows the first ping in the floating notification immediately', () => {
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

  it('localizes the live counter to German', () => {
    render(<HeroBackdrop copy={COPY.de} pings={samplePings} channelsLast24h={47} />)
    expect(screen.getByText(/47 Kanäle in den letzten 24 Stunden entdeckt/)).toBeInTheDocument()
    expect(screen.getByText(/Kanal entdeckt/)).toBeInTheDocument()
  })

  it('renders the "Next scan in" countdown overlay anchored to the top of the next hour', () => {
    // Pin clock to xx:47:18 — countdown should read "12m 42s" until top of hour.
    jest.setSystemTime(new Date('2026-05-03T10:47:18.000Z'))
    render(<HeroBackdrop copy={COPY.en} pings={samplePings} channelsLast24h={47} />)
    expect(screen.getByText(/Next scan in/i)).toBeInTheDocument()
    expect(screen.getByText('12m 42s')).toBeInTheDocument()
  })
})
