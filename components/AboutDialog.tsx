"use client"
import { useEffect, useRef } from "react"
import { APP_VERSION } from "@/lib/app/version"

/** About Buzz (Req 13.8): version, copyright, and that Buzz is not Yahoo's. */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  const okRef = useRef<HTMLButtonElement>(null)
  // Callers pass a new function each render; keep the latest without re-running the effect.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])
  useEffect(() => {
    // Remember where focus was, and put it back when the dialog closes.
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
    okRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onCloseRef.current()
      } else if (e.key === "Tab") {
        // OK is the only control, so Tab keeps focus inside the dialog.
        e.preventDefault()
        okRef.current?.focus()
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
      <div role="dialog" aria-modal="true" aria-labelledby="about-buzz-title" className="ym-window w-full max-w-xs shadow">
        <div className="ym-titlebar">
          <span id="about-buzz-title">About Buzz</span>
        </div>
        <div className="flex flex-col items-center gap-2 p-4 text-center text-sm">
          <p className="m-0 text-lg font-bold" style={{ color: "var(--ym-purple)" }}>
            Buzz
          </p>
          <p className="m-0">Version {APP_VERSION}</p>
          <p className="m-0 text-xs">© 2026 the Buzz authors.</p>
          <p className="m-0 text-xs">
            A love letter to classic instant messengers. Buzz is not affiliated with or endorsed by Yahoo.
          </p>
          <button ref={okRef} type="button" className="ym-button mt-1 px-6" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
