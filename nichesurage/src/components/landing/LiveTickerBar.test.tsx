import { render, screen } from '@testing-library/react'
import { LiveTickerBar } from './LiveTickerBar'
import { COPY } from './copy'

describe('LiveTickerBar', () => {
  it('renders the LIVE badge plus both stats in EN', () => {
    render(
      <LiveTickerBar copy={COPY.en} spikedLastHour={47} nichesSurfacedToday={27} />,
    )
    expect(screen.getByText('LIVE')).toBeInTheDocument()
    expect(screen.getByText(/47 channels spiked in the last hour/)).toBeInTheDocument()
    expect(screen.getByText(/27 new niches surfaced today/)).toBeInTheDocument()
  })

  it('localizes both stats to DE', () => {
    render(
      <LiveTickerBar copy={COPY.de} spikedLastHour={47} nichesSurfacedToday={27} />,
    )
    expect(screen.getByText(/47 Kanäle stiegen in der letzten Stunde/)).toBeInTheDocument()
    expect(screen.getByText(/27 neue Nischen heute entdeckt/)).toBeInTheDocument()
  })

  it('exposes a status role for screen readers', () => {
    render(
      <LiveTickerBar copy={COPY.en} spikedLastHour={5} nichesSurfacedToday={3} />,
    )
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute(
      'aria-label',
      expect.stringContaining('5 channels spiked in the last hour'),
    )
    expect(status).toHaveAttribute(
      'aria-label',
      expect.stringContaining('3 new niches surfaced today'),
    )
  })
})
