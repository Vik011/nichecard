'use client'

import { useEffect, useState, type RefObject } from 'react'

// Drag-to-dismiss threshold as a fraction of the sheet's own height.
// 30% per spec (section 1, Mobile bottom sheet). Above this, release =
// dismiss; below this, release = spring back to translateY(0).
const DISMISS_THRESHOLD = 0.3

interface UseDragToDismissOptions {
  /** Ref to the sheet element. We listen for touch events on this node. */
  sheetRef: RefObject<HTMLElement>
  /** Called once when the user releases past the dismiss threshold. */
  onDismiss: () => void
  /** When false, listeners are not attached. Used to skip on desktop. */
  enabled: boolean
}

interface UseDragToDismissResult {
  /** Current translateY in pixels, clamped to >= 0 (no upward drag). */
  translateY: number
  /** True while a touch is active and has moved at least 1px. */
  dragging: boolean
}

export function useDragToDismiss({ sheetRef, onDismiss, enabled }: UseDragToDismissOptions): UseDragToDismissResult {
  const [translateY, setTranslateY] = useState(0)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const el = sheetRef.current
    if (!enabled || !el) return

    let startY: number | null = null
    let currentDelta = 0

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return
      startY = e.touches[0].clientY
      currentDelta = 0
      setDragging(true)
    }

    function onTouchMove(e: TouchEvent) {
      if (startY === null) return
      const dy = e.touches[0].clientY - startY
      // Clamp upward drag. Sheet only moves down, never up.
      currentDelta = Math.max(0, dy)
      setTranslateY(currentDelta)
    }

    function onTouchEnd() {
      if (startY === null) return
      const sheetEl = sheetRef.current
      const sheetHeight = sheetEl ? sheetEl.getBoundingClientRect().height : 0
      const threshold = sheetHeight * DISMISS_THRESHOLD
      if (currentDelta > threshold) {
        onDismiss()
      }
      // Spring back regardless. If dismiss fires, the parent will unmount;
      // if not, we want translate back to 0 anyway.
      setTranslateY(0)
      setDragging(false)
      startY = null
      currentDelta = 0
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [sheetRef, onDismiss, enabled])

  return { translateY, dragging }
}
