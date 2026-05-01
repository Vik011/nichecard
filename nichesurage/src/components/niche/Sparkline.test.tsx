import { render, screen } from '@testing-library/react'
import { Sparkline } from './Sparkline'
import type { SpikePoint } from '@/lib/types'

const data: SpikePoint[] = [
  { day: '2026-04-01', spikeX: 1.0 },
  { day: '2026-04-02', spikeX: 2.5 },
  { day: '2026-04-03', spikeX: 4.0 },
  { day: '2026-04-04', spikeX: 3.2 },
]

describe('Sparkline', () => {
  it('renders an SVG when data has 2+ points', () => {
    const { container } = render(<Sparkline data={data} variant="card" />)
    expect(container.querySelector('svg')).toBeTruthy()
    expect(container.querySelector('polyline')).toBeTruthy()
  })

  it('renders an em-dash placeholder when data is empty', () => {
    render(<Sparkline data={[]} variant="card" />)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('renders an em-dash placeholder when data has only 1 point', () => {
    render(<Sparkline data={[{ day: '2026-04-01', spikeX: 1 }]} variant="card" />)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('uses larger dimensions for variant="detail"', () => {
    const { container } = render(<Sparkline data={data} variant="detail" />)
    const svg = container.querySelector('svg')!
    expect(Number(svg.getAttribute('viewBox')!.split(' ')[2])).toBeGreaterThanOrEqual(400)
  })
})
