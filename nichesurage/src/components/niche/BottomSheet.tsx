'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react/dist/ssr'
import { useDragToDismiss } from '@/lib/hooks/useDragToDismiss'

// Mobile-only bottom sheet. The desktop counterpart is NicheDetailModal's
// centered-dialog branch. Slides up from the bottom edge, occupies 90vh,
// shows a drag handle and supports swipe-down-to-dismiss in addition to
// the X button, ESC key, and backdrop tap.

export interface BottomSheetProps {
  open: boolean
  onClose: () => void
  ariaLabel?: string
  children: ReactNode
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function BottomSheet({ open, onClose, ariaLabel, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const previousActiveRef = useRef<Element | null>(null)

  const { translateY, dragging } = useDragToDismiss({
    sheetRef,
    onDismiss: onClose,
    enabled: open,
  })

  // ESC + Tab trap (mirrors NicheDetailModal behavior).
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const root = sheetRef.current
      if (!root) return
      const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null,
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // Body scroll lock + focus restore (mirrors NicheDetailModal behavior).
  useEffect(() => {
    if (!open) return
    previousActiveRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => {
      const root = sheetRef.current
      if (!root) return
      const firstFocusable = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      ;(firstFocusable ?? root).focus()
    }, 0)
    return () => {
      clearTimeout(t)
      document.body.style.overflow = previousOverflow
      const prev = previousActiveRef.current
      if (prev instanceof HTMLElement) prev.focus()
    }
  }, [open])

  if (!open) return null
  if (typeof document === 'undefined') return null

  function handleBackdropMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  // While the user is actively dragging we kill the slide-up transition
  // so the sheet tracks the finger 1:1. On release the transition snaps
  // back in so spring-back-to-zero is smooth.
  const transitionClass = dragging ? '' : 'transition-transform duration-200 ease-out'

  return createPortal(
    <div
      onMouseDown={handleBackdropMouseDown}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-lg"
      aria-hidden={false}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? 'Niche detail'}
        tabIndex={-1}
        style={{ transform: `translateY(${translateY}px)` }}
        className={`relative w-full max-h-[90vh] overflow-y-auto overflow-x-hidden bg-canvas rounded-t-2xl shadow-2xl border-t border-x border-hairline-soft outline-none ${transitionClass}`}
      >
        <div className="flex justify-center pt-2 pb-1" aria-hidden>
          <div data-testid="bottom-sheet-handle" className="h-1 w-9 rounded-full bg-white/20" />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface-raised/80 text-ink-muted hover:bg-surface-elevated hover:text-ink border border-hairline-soft backdrop-blur-md transition-colors"
        >
          <X weight="bold" size={16} aria-hidden />
        </button>
        <div className="px-5 pt-2 pb-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
