/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react'
import { useDragToDismiss } from './useDragToDismiss'

function makeRef(height = 600): React.RefObject<HTMLDivElement> {
  const el = document.createElement('div')
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ height, width: 375, top: 0, left: 0, right: 375, bottom: height, x: 0, y: 0, toJSON() { return {} } }),
  })
  return { current: el } as React.RefObject<HTMLDivElement>
}

function touchEvent(type: 'touchstart' | 'touchmove' | 'touchend', clientY: number) {
  return new TouchEvent(type, {
    touches: type === 'touchend' ? [] : ([{ clientY } as unknown as Touch]),
    changedTouches: [{ clientY } as unknown as Touch],
    bubbles: true,
    cancelable: true,
  })
}

describe('useDragToDismiss', () => {
  it('returns translateY of 0 initially', () => {
    const ref = makeRef()
    const { result } = renderHook(() => useDragToDismiss({ sheetRef: ref, onDismiss: jest.fn(), enabled: true }))
    expect(result.current.translateY).toBe(0)
    expect(result.current.dragging).toBe(false)
  })

  it('does not call onDismiss when drag distance is below the 30% threshold', () => {
    const ref = makeRef(600)  // 30% threshold = 180px
    const onDismiss = jest.fn()
    const { result } = renderHook(() => useDragToDismiss({ sheetRef: ref, onDismiss, enabled: true }))

    act(() => {
      ref.current!.dispatchEvent(touchEvent('touchstart', 100))
      ref.current!.dispatchEvent(touchEvent('touchmove', 200))  // moved 100px, under 180
      ref.current!.dispatchEvent(touchEvent('touchend', 200))
    })

    expect(onDismiss).not.toHaveBeenCalled()
    expect(result.current.translateY).toBe(0)  // spring back
  })

  it('calls onDismiss when drag distance crosses the 30% threshold', () => {
    const ref = makeRef(600)
    const onDismiss = jest.fn()
    renderHook(() => useDragToDismiss({ sheetRef: ref, onDismiss, enabled: true }))

    act(() => {
      ref.current!.dispatchEvent(touchEvent('touchstart', 100))
      ref.current!.dispatchEvent(touchEvent('touchmove', 320))  // moved 220px, over 180
      ref.current!.dispatchEvent(touchEvent('touchend', 320))
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('ignores upward drags (negative deltaY clamped to 0)', () => {
    const ref = makeRef(600)
    const onDismiss = jest.fn()
    const { result } = renderHook(() => useDragToDismiss({ sheetRef: ref, onDismiss, enabled: true }))

    act(() => {
      ref.current!.dispatchEvent(touchEvent('touchstart', 200))
      ref.current!.dispatchEvent(touchEvent('touchmove', 50))  // moved -150px
    })

    expect(result.current.translateY).toBe(0)
  })

  it('no-ops when enabled=false', () => {
    const ref = makeRef(600)
    const onDismiss = jest.fn()
    const { result } = renderHook(() => useDragToDismiss({ sheetRef: ref, onDismiss, enabled: false }))

    act(() => {
      ref.current!.dispatchEvent(touchEvent('touchstart', 100))
      ref.current!.dispatchEvent(touchEvent('touchmove', 400))
      ref.current!.dispatchEvent(touchEvent('touchend', 400))
    })

    expect(onDismiss).not.toHaveBeenCalled()
    expect(result.current.translateY).toBe(0)
  })
})
