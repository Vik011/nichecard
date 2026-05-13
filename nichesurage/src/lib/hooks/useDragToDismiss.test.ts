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

  it('gesture survives a re-render between touchstart and touchmove (no stale closure)', () => {
    const ref = makeRef(600)
    const onDismiss1 = jest.fn()
    const onDismiss2 = jest.fn()
    const { rerender } = renderHook(
      ({ onDismiss }) => useDragToDismiss({ sheetRef: ref, onDismiss, enabled: true }),
      { initialProps: { onDismiss: onDismiss1 } },
    )

    // Start the drag with the initial onDismiss.
    act(() => {
      ref.current!.dispatchEvent(touchEvent('touchstart', 100))
    })

    // Parent re-renders, swaps in a new onDismiss reference.
    rerender({ onDismiss: onDismiss2 })

    // Continue and release the drag past threshold (>180px on 600px sheet).
    act(() => {
      ref.current!.dispatchEvent(touchEvent('touchmove', 320))
      ref.current!.dispatchEvent(touchEvent('touchend', 320))
    })

    // The original onDismiss should NOT be called (we replaced it).
    expect(onDismiss1).not.toHaveBeenCalled()
    // The latest onDismiss SHOULD be called once.
    expect(onDismiss2).toHaveBeenCalledTimes(1)
  })

  it('aborts the gesture if a second finger joins mid-drag', () => {
    const ref = makeRef(600)
    const onDismiss = jest.fn()
    const { result } = renderHook(() => useDragToDismiss({ sheetRef: ref, onDismiss, enabled: true }))

    act(() => {
      // Start single-finger drag
      ref.current!.dispatchEvent(touchEvent('touchstart', 100))
      ref.current!.dispatchEvent(touchEvent('touchmove', 200))
    })
    expect(result.current.dragging).toBe(true)

    // Second finger joins.
    act(() => {
      const multiEvent = new TouchEvent('touchmove', {
        touches: [{ clientY: 200 } as unknown as Touch, { clientY: 300 } as unknown as Touch],
        changedTouches: [{ clientY: 300 } as unknown as Touch],
        bubbles: true,
        cancelable: true,
      })
      ref.current!.dispatchEvent(multiEvent)
    })

    // Gesture aborted: dragging back to false, translateY reset.
    expect(result.current.dragging).toBe(false)
    expect(result.current.translateY).toBe(0)

    // Primary finger lifts -- should NOT trigger dismiss (state already reset).
    act(() => {
      ref.current!.dispatchEvent(touchEvent('touchend', 400))
    })
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
