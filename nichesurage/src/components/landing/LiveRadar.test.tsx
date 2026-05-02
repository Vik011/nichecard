import { render, screen, act } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { LiveRadar } from './LiveRadar'
import { COPY } from './copy'
import type { RadarPing } from '@/lib/landing/fetchRadarPings'

// Strip framer-motion animations in tests so timer advances render the
// next ping synchronously instead of waiting for AnimatePresence exit.
jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: new Proxy({}, {
    get: () => (props: ComponentProps<'div'>) => <div {...props} />,
  }),
}))

const samplePings: RadarPing[] = [
  { id: 'p1', outlierRatio: 3.2, clusterLabel: 'Stoic Mind Rewiring', language: 'en', contentType: 'longform' },
  { id: 'p2', outlierRatio: 7.5, clusterLabel: 'Faceless AI Income Blueprint', language: 'en', contentType: 'shorts' },
  { id: 'p3', outlierRatio: 12.0, clusterLabel: null, language: 'de', contentType: 'shorts' },
]

describe('LiveRadar', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders the live counter with the provided 24h count', () => {
    render(<LiveRadar copy={COPY.en} pings={samplePings} channelsLast24h={47} />)
    expect(screen.getByText(/47 channels surfaced in the last 24h/)).toBeInTheDocument()
  })

  it('shows the first ping immediately', () => {
    render(<LiveRadar copy={COPY.en} pings={samplePings} channelsLast24h={47} />)
    expect(screen.getByText(/3\.2× outlier/)).toBeInTheDocument()
    expect(screen.getByText(/Stoic Mind Rewiring/)).toBeInTheDocument()
  })

  it('rotates to the second ping after the interval elapses', () => {
    render(<LiveRadar copy={COPY.en} pings={samplePings} channelsLast24h={47} />)
    expect(screen.getByText(/3\.2× outlier/)).toBeInTheDocument()
    act(() => {
      jest.advanceTimersByTime(2800)
    })
    expect(screen.getByText(/7\.5× outlier/)).toBeInTheDocument()
  })

  it('falls back to the unclustered label when a ping has no cluster', () => {
    render(<LiveRadar copy={COPY.en} pings={[samplePings[2]]} channelsLast24h={1} />)
    expect(screen.getByText(/Forming cluster/)).toBeInTheDocument()
  })

  it('renders the subline when there are no pings to show', () => {
    render(<LiveRadar copy={COPY.en} pings={[]} channelsLast24h={0} />)
    expect(screen.getByText(/Watching the small accounts/)).toBeInTheDocument()
  })

  it('localizes the live counter to German', () => {
    render(<LiveRadar copy={COPY.de} pings={samplePings} channelsLast24h={47} />)
    expect(screen.getByText(/47 Kanäle in den letzten 24 Stunden entdeckt/)).toBeInTheDocument()
    expect(screen.getByText(/Kanal entdeckt/)).toBeInTheDocument()
  })
})
