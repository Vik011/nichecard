import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { HealthCheckModal } from './HealthCheckModal'

const successResponse = {
  score: 78,
  components: { spike: 22, opportunity: 19, engagement: 14, virality: 10, saturation: 12 },
  verdict: 'Spike multiplier is the standout signal here. Engagement is healthy enough to support a launch this week, but channel saturation is creeping up — competitors with 200k+ subs already have a foothold. Lead with a sharp differentiator on the first three uploads or skip.',
  cached: false,
}

describe('HealthCheckModal', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('shows loading state initially', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch
    render(<HealthCheckModal scanResultId="abc" nicheLabel="silent study desk" onClose={() => {}} />)
    expect(screen.getByTestId('health-check-loading')).toBeInTheDocument()
  })

  it('renders score and verdict on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => successResponse,
    }) as unknown as typeof fetch

    render(<HealthCheckModal scanResultId="abc" nicheLabel="silent study desk" onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('health-check-ready')).toBeInTheDocument())
    expect(screen.getByText('78')).toBeInTheDocument()
    expect(screen.getByText(/Spike multiplier is the standout signal/)).toBeInTheDocument()
  })

  it('renders error state on 5xx response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'server boom' }),
    }) as unknown as typeof fetch

    render(<HealthCheckModal scanResultId="abc" nicheLabel="x" onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('health-check-error')).toBeInTheDocument())
    expect(screen.getByText('server boom')).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => successResponse,
    }) as unknown as typeof fetch
    const onClose = jest.fn()

    render(<HealthCheckModal scanResultId="abc" nicheLabel="x" onClose={onClose} />)
    const backdrop = screen.getByRole('dialog')
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Escape pressed', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => successResponse,
    }) as unknown as typeof fetch
    const onClose = jest.fn()

    render(<HealthCheckModal scanResultId="abc" nicheLabel="x" onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
