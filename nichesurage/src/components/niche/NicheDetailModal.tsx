'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react/dist/ssr'

// Niche-detail modal that opens over /discover when a user clicks a card.
//
// Why a modal over a route push: the standalone /discover/niche/[id] page
// reads as overwhelming on first scroll (~3 viewports for free users, with
// AI locked teasers eating ~900px of mandatory scroll). User feedback
// 2026-05-07: "kartica koja se otvori, bukvalno ide preko celog app...
// pokrije 90%+ ekrana, nepregledno". A modal keeps the discover grid
// visible behind a translucent backdrop and caps height at 85vh, so the
// detail view never claims the whole screen and the close affordance is
// always one click away.
//
// The standalone page route still exists for direct URL access (bookmarks,
// link shares, SEO). Both surfaces share `NicheDetailContent` so we don't
// drift.
//
// Mobile (< 768px) gets the same centered layout but with full width and
// reduced padding. A dedicated bottom-sheet pattern with swipe-down gesture
// is on the roadmap; keeping a single layout for v1 to ship the redesign
// quickly.

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
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const previousActiveRef = useRef<Element | null>(null)

  // ESC closes; trap Tab inside the dialog so focus can't escape into the
  // backdrop or the now-static /discover grid behind us.
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

  // Body scroll lock + focus management. Remember the element that opened
  // the modal so we can restore focus on close (a11y fundamentals; without
  // this, screen readers and keyboard users get dumped at the top of the page).
  useEffect(() => {
    if (!open) return
    previousActiveRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Defer focus until the dialog has actually mounted into the DOM.
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

  // The backdrop is its own button-role layer so click-outside closes
  // without bubbling the click into the dialog itself. mousedown is used
  // (not click) so a click that started inside the dialog and ended on
  // the backdrop — e.g. text selection drag — does not close the modal.
  function handleBackdropMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return createPortal(
    <div
      onMouseDown={handleBackdropMouseDown}
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center px-3 py-6 md:py-10 bg-black/70 backdrop-blur-md"
      aria-hidden={false}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? 'Niche detail'}
        tabIndex={-1}
        className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto bg-charcoal-950 rounded-2xl shadow-2xl border border-white/[0.06] outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="sticky top-3 z-10 ml-auto mr-3 mt-3 flex h-9 w-9 items-center justify-center rounded-full bg-charcoal-900/80 text-slate-300 hover:bg-charcoal-800 hover:text-white border border-white/[0.06] backdrop-blur-md transition-colors"
        >
          <X weight="bold" size={16} aria-hidden />
        </button>
        <div className="px-5 md:px-7 pt-2 pb-7">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
