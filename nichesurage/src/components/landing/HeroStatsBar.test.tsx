import { render, screen, act } from '@testing-library/react'
import { HeroStatsBar } from './HeroStatsBar'
import { COPY } from './copy'

describe('HeroStatsBar', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders the three column labels in EN', () => {
    jest.setSystemTime(new Date('2026-05-06T10:30:18.000Z'))
    render(<HeroStatsBar copy={COPY.en} spikedLast24h={36} />)
    // Hydrate the timer hook
    act(() => {
      jest.advanceTimersByTime(1100)
    })
    expect(screen.getByText('FACELESS CHANNELS TRACKED')).toBeInTheDocument()
    expect(screen.getByText('Next scan')).toBeInTheDocument()
    expect(screen.getByText('SPIKED · LAST 24H')).toBeInTheDocument()
    expect(screen.getByText('SCAN INTERVAL')).toBeInTheDocument()
  })

  it('renders the tracked-channels value from copy', () => {
    jest.setSystemTime(new Date('2026-05-06T10:00:00.000Z'))
    render(<HeroStatsBar copy={COPY.en} spikedLast24h={36} />)
    act(() => {
      jest.advanceTimersByTime(1100)
    })
    expect(screen.getByText('250+')).toBeInTheDocument()
  })

  it('formats the timer as M:SS counting down to top of next hour', () => {
    // Pin clock at xx:30:18 → countdown should read 29:42 to top of hour
    jest.setSystemTime(new Date('2026-05-06T10:30:18.000Z'))
    render(<HeroStatsBar copy={COPY.en} spikedLast24h={36} />)
    act(() => {
      jest.advanceTimersByTime(1100)
    })
    expect(screen.getByText('29:41')).toBeInTheDocument()
  })

  it('shows the SPIKED · LAST 24H count', () => {
    jest.setSystemTime(new Date('2026-05-06T10:00:00.000Z'))
    render(<HeroStatsBar copy={COPY.en} spikedLast24h={123} />)
    act(() => {
      jest.advanceTimersByTime(1100)
    })
    expect(screen.getByText('123')).toBeInTheDocument()
  })

  it('localizes the labels to DE', () => {
    jest.setSystemTime(new Date('2026-05-06T10:00:00.000Z'))
    render(<HeroStatsBar copy={COPY.de} spikedLast24h={36} />)
    act(() => {
      jest.advanceTimersByTime(1100)
    })
    expect(screen.getByText('FACELESS-KANÄLE IM TRACKING')).toBeInTheDocument()
    expect(screen.getByText('Nächster Scan')).toBeInTheDocument()
    expect(screen.getByText('SPIKES · LETZTE 24H')).toBeInTheDocument()
    expect(screen.getByText('SCAN-INTERVALL')).toBeInTheDocument()
  })
})
