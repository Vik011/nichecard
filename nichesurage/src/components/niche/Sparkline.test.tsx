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

  it('defaults to strong tier when no tier prop is given', () => {
    const { container } = render(<Sparkline data={data} variant="card" />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('data-tier')).toBe('strong')
  })

  it('renders the tier passed via prop on the data attribute', () => {
    const { container } = render(<Sparkline data={data} variant="card" tier="excellent" />)
    expect(container.querySelector('svg')!.getAttribute('data-tier')).toBe('excellent')
  })

  it('uses a distinct gradient id per tier so multiple sparklines coexist', () => {
    const { container: a } = render(<Sparkline data={data} variant="card" tier="excellent" />)
    const { container: b } = render(<Sparkline data={data} variant="card" tier="weak" />)
    const idA = a.querySelector('linearGradient')!.getAttribute('id')!
    const idB = b.querySelector('linearGradient')!.getAttribute('id')!
    expect(idA).not.toBe(idB)
  })

  it('paints the excellent tier in deep cyan (Midnight palette accent)', () => {
    const { container } = render(<Sparkline data={data} variant="card" tier="excellent" />)
    const stroke = container.querySelector('polyline')!.getAttribute('stroke')!
    expect(stroke).toBe('rgb(6 182 212)')
  })

  it('paints the strong tier in indigo-bright (default brand accent)', () => {
    const { container } = render(<Sparkline data={data} variant="card" tier="strong" />)
    const stroke = container.querySelector('polyline')!.getAttribute('stroke')!
    expect(stroke).toBe('rgb(129 140 248)')
  })
})

describe('tierFromScore', () => {
  it('maps score bands to tiers', () => {
    const { tierFromScore } = jest.requireActual<typeof import('./Sparkline')>('./Sparkline')
    expect(tierFromScore(85)).toBe('excellent')
    expect(tierFromScore(70)).toBe('excellent')
    expect(tierFromScore(60)).toBe('strong')
    expect(tierFromScore(50)).toBe('strong')
    expect(tierFromScore(40)).toBe('average')
    expect(tierFromScore(30)).toBe('average')
    expect(tierFromScore(20)).toBe('weak')
    expect(tierFromScore(0)).toBe('weak')
  })
})
