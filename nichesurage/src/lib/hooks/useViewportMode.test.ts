/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react'
import { useViewportMode } from './useViewportMode'

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
  window.dispatchEvent(new Event('resize'))
}

describe('useViewportMode', () => {
  it('returns "desktop" by default before any resize', () => {
    setViewport(1280)
    const { result } = renderHook(() => useViewportMode())
    expect(result.current).toBe('desktop')
  })

  it('returns "tablet" between 640 and 1023', () => {
    setViewport(800)
    const { result } = renderHook(() => useViewportMode())
    expect(result.current).toBe('tablet')
  })

  it('returns "mobile" below 640', () => {
    setViewport(375)
    const { result } = renderHook(() => useViewportMode())
    expect(result.current).toBe('mobile')
  })

  it('updates on resize', () => {
    setViewport(1280)
    const { result } = renderHook(() => useViewportMode())
    expect(result.current).toBe('desktop')

    act(() => setViewport(500))
    expect(result.current).toBe('mobile')

    act(() => setViewport(800))
    expect(result.current).toBe('tablet')
  })
})
