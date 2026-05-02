import { render, screen } from '@testing-library/react'
import { SpikingBadge } from './SpikingBadge'

describe('SpikingBadge', () => {
  it('renders with default label "Spiking Now"', () => {
    render(<SpikingBadge />)
    expect(screen.getByRole('status', { name: /spiking now/i })).toBeInTheDocument()
  })

  it('accepts a custom label', () => {
    render(<SpikingBadge label="Hot Now" />)
    expect(screen.getByRole('status', { name: /hot now/i })).toBeInTheDocument()
  })

  it('renders the pulsing ping dot', () => {
    const { container } = render(<SpikingBadge />)
    expect(container.querySelector('.animate-ping')).toBeInTheDocument()
  })
})
