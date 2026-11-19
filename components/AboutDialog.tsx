"use client"
import { APP_VERSION } from "@/lib/app/version"
import { Dialog } from "./Dialog"

/** About Buzz (Req 13.8): version, copyright, and that Buzz is not Yahoo's. */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="About Buzz" onClose={onClose}>
      <div className="flex flex-col items-center gap-2 p-1 text-center">
        <p className="m-0 text-lg font-bold" style={{ color: "var(--ym-purple)" }}>
          Buzz
        </p>
        <p className="m-0">Version {APP_VERSION}</p>
        <p className="m-0 text-xs">© 2026 the Buzz authors.</p>
        <p className="m-0 text-xs">
          A love letter to classic instant messengers. Buzz is not affiliated with or endorsed by Yahoo.
        </p>
        <button type="button" className="ym-button mt-1 px-6" onClick={onClose}>
          OK
        </button>
      </div>
    </Dialog>
  )
}
