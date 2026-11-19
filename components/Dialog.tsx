"use client"
import { useEffect, useId, useRef, type ReactNode } from "react"

const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])"

/**
 * A small modal window in the Buzz look: a title bar and a body. Escape or a
 * click outside closes it, Tab stays inside, and focus goes back to where it
 * was when it closes. The first button (or `autoFocus` control) gets focus.
 */
export function Dialog({
  title,
  onClose,
  role = "dialog",
  children,
}: {
  title: string
  onClose: () => void
  /** "alertdialog" for a question that needs an answer, like Ignore. */
  role?: "dialog" | "alertdialog"
  children: ReactNode
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // Callers pass a new function each render; keep the latest without re-running the effect.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const box = boxRef.current
    const first = box?.querySelector<HTMLElement>("[autofocus]") ?? box?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onCloseRef.current()
      } else if (e.key === "Tab" && box) {
        const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (items.length === 0) return
        const at = document.activeElement instanceof HTMLElement ? items.indexOf(document.activeElement) : -1
        const next = e.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : (at + 1) % items.length
        e.preventDefault()
        items[next].focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      before?.focus()
    }
  }, [])
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: "rgb(0 0 0 / 0.25)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div ref={boxRef} role={role} aria-modal="true" aria-labelledby={titleId} className="ym-window w-full max-w-xs shadow">
        <div className="ym-titlebar">
          <span id={titleId}>{title}</span>
        </div>
        <div className="p-3 text-sm">{children}</div>
      </div>
    </div>
  )
}
