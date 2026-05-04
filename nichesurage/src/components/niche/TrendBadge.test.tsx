import { render, screen } from '@testing-library/react'
import { TrendBadge } from './TrendBadge'
import type { TrendData, TrendLifecycle } from '@/lib/types'

function makeData(overrides: Partial<TrendData> = {}): TrendData {
  return {
    trendScore: 0,
    lifecycleStatus: null,
    clusterSize: 0,
    ...overrides,
  }
}

describe('TrendBadge', () => {
  it('renders TRENDING + lifecycle pill when trendScore is high but cluster is small', () => {
    render(<TrendBadge data={makeData({ trendScore: 75, lifecycleStatus: 'exploding', clusterSize: 1 })} />)
    expect(screen.getByText(/TRENDING/i)).toBeInTheDocument()
    expect(screen.getByText('Exploding')).toBeInTheDocument()
    // No cluster pill (clusterSize < threshold)
    expect(screen.queryByText(/channels/i)).toBeNull()
    expect(screen.queryByText(/Cross-niche/i)).toBeNull()
  })

  it('renders TRENDING + cluster pill when clusterSize is high but score is low', () => {
    render(<TrendBadge data={makeData({ trendScore: 10, lifecycleStatus: 'emerging', clusterSize: 12 })} />)
    expect(screen.getByText(/TRENDING/i)).toBeInTheDocument()
    expect(screen.getByText('12 channels')).toBeInTheDocument()
  })

  it('renders nothing when both score and cluster are below thresholds', () => {
    const { container } = render(
      <TrendBadge data={makeData({ trendScore: 30, lifecycleStatus: 'emerging', clusterSize: 2 })} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders 🚨 Cross-niche pill instead of channel count for mega-clusters', () => {
    render(
      <TrendBadge
        data={makeData({
          trendScore: 80,
          lifecycleStatus: 'peak',
          clusterSize: 25,
          isMegaCluster: true,
        })}
      />
    )
    expect(screen.getByText(/Cross-niche/i)).toBeInTheDocument()
    expect(screen.queryByText(/25 channels/i)).toBeNull()
  })

  it('composes tooltip from archetype + cluster label when both present', () => {
    const { container } = render(
      <TrendBadge
        data={makeData({
          trendScore: 80,
          clusterSize: 8,
          clusterLabel: 'AI productivity hacks',
          narrativeArchetypeLabel: 'Underdog gets revenge',
        })}
      />
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('title')).toBe('Underdog gets revenge • AI productivity hacks')
  })

  it('renders all 5 lifecycle variants with their distinct labels', () => {
    const variants: TrendLifecycle[] = ['emerging', 'exploding', 'peak', 'saturated', 'dying']
    const expectedLabels = ['Emerging', 'Exploding', 'Peak', 'Saturated', 'Dying']
    variants.forEach((status, i) => {
      const { unmount } = render(
        <TrendBadge data={makeData({ trendScore: 80, lifecycleStatus: status })} />
      )
      expect(screen.getByText(expectedLabels[i])).toBeInTheDocument()
      unmount()
    })
  })

  it('renders TRENDING + cluster pill but no lifecycle pill when lifecycleStatus is null', () => {
    render(<TrendBadge data={makeData({ trendScore: 75, lifecycleStatus: null, clusterSize: 6 })} />)
    expect(screen.getByText(/TRENDING/i)).toBeInTheDocument()
    expect(screen.getByText(/6 channels/i)).toBeInTheDocument()
    // None of the lifecycle labels should be present
    expect(screen.queryByText('Emerging')).toBeNull()
    expect(screen.queryByText('Exploding')).toBeNull()
    expect(screen.queryByText('Peak')).toBeNull()
    expect(screen.queryByText('Saturated')).toBeNull()
    expect(screen.queryByText('Dying')).toBeNull()
  })
})
