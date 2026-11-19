"use client"
import { useEffect, useRef } from "react"
import { APP_VERSION } from "@/lib/app/version"

/** About Buzz (Req 13.8): version, copyright, and that Buzz is not Yahoo's. */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  const okRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    okRef.current?.focus()
  }, [])
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-buzz-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: "rgb(0 0 0 / 0.25)" }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose()
      }}
    >
      <div className="ym-window w-full max-w-xs shadow">
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
