import { render, screen } from '@testing-library/react'
import { LiveTickerBar } from './LiveTickerBar'
import { COPY } from './copy'

describe('LiveTickerBar', () => {
  it('renders the LIVE badge plus both stats in EN', () => {
    render(<LiveTickerBar copy={COPY.en} spikedLast24h={36} />)
    expect(screen.getByText('LIVE')).toBeInTheDocument()
    expect(screen.getByText(/36 channels spiked in the last 24h/)).toBeInTheDocument()
    expect(screen.getByText(/590\+ channels monitored/)).toBeInTheDocument()
  })

  it('localizes both stats to DE', () => {
    render(<LiveTickerBar copy={COPY.de} spikedLast24h={36} />)
    expect(screen.getByText(/36 Kanäle stiegen in den letzten 24h/)).toBeInTheDocument()
    expect(screen.getByText(/590\+ Kanäle im Monitoring/)).toBeInTheDocument()
  })

  it('exposes a status role for screen readers', () => {
    render(<LiveTickerBar copy={COPY.en} spikedLast24h={5} />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute(
      'aria-label',
      expect.stringContaining('5 channels spiked in the last 24h'),
    )
    expect(status).toHaveAttribute(
      'aria-label',
      expect.stringContaining('590+ channels monitored'),
    )
  })
})
