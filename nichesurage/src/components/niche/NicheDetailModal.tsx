'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react/dist/ssr'
import { useViewportMode } from '@/lib/hooks/useViewportMode'
import { BottomSheet } from './BottomSheet'

// Niche-detail modal that opens over /discover when a user clicks a card.
//
// Desktop / tablet (>= 640px): centered dialog with backdrop.
// Mobile (< 640px): BottomSheet primitive (slides up from bottom, swipe
// to dismiss). The branch is decided at runtime via useViewportMode so
// only one tree mounts. This avoids duplicate body-scroll-lock effects.

export interface NicheDetailModalProps {
  /** Whether the modal is mounted. Parent controls open state via URL param. */
  open: boolean
  /** Called when the user closes the modal (X button, ESC, backdrop click). */
  onClose: () => void
  /** Optional aria-label fallback when the dialog has no visible heading. */
  ariaLabel?: string
  children: ReactNode
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function NicheDetailModal({ open, onClose, ariaLabel, children }: NicheDetailModalProps) {
  const viewportMode = useViewportMode()
  if (viewportMode === 'mobile') {
    return (
      <BottomSheet open={open} onClose={onClose} ariaLabel={ariaLabel}>
        {children}
      </BottomSheet>
    )
  }
  return (
    <CenteredDialog open={open} onClose={onClose} ariaLabel={ariaLabel}>
      {children}
    </CenteredDialog>
  )
}

function CenteredDialog({ open, onClose, ariaLabel, children }: NicheDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const previousActiveRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const root = dialogRef.current
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

  useEffect(() => {
    if (!open) return
    previousActiveRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => {
      const root = dialogRef.current
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

  return createPortal(
    <div
      onMouseDown={handleBackdropMouseDown}
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center px-3 py-6 md:py-10 bg-black/40 backdrop-blur-lg"
      aria-hidden={false}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? 'Niche detail'}
        tabIndex={-1}
        className="relative w-full max-w-6xl max-h-[85vh] overflow-y-auto overflow-x-hidden bg-charcoal-950 rounded-2xl shadow-2xl border border-white/[0.06] outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="sticky top-3 z-10 ml-auto mr-3 mt-3 flex h-9 w-9 items-center justify-center rounded-full bg-charcoal-900/80 text-slate-300 hover:bg-charcoal-800 hover:text-white border border-white/[0.06] backdrop-blur-md transition-colors"
        >
          <X weight="bold" size={16} aria-hidden />
        </button>
        <div className="px-5 md:px-6 pt-2 pb-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
